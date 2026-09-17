/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./settings.css";

import { isPluginEnabled } from "@api/PluginManager";
import { Heading } from "@components/Heading";
import { resolveError } from "@components/settings/tabs/plugins/components/Common";
import { debounce } from "@shared/debounce";
import { classNameFactory } from "@utils/css";
import {
  Button,
  Select,
  Text,
  TextInput,
  useEffect,
  useRef,
  useState,
} from "@webpack/common";

import GameRPCPlugin, {
  searchDetectableApplications,
  resetTimestampStart,
  setRpc,
  settings,
  TimestampMode,
  validateApplicationId,
  type DetectableApplication,
} from ".";

const cl = classNameFactory("vc-gameRPC-settings-");

type SettingsKey = keyof typeof settings.store;

interface TextOption<T> {
  settingsKey: SettingsKey;
  label: string;
  disabled?: boolean;
  transform?: (value: string) => T;
  isValid?: (value: T) => true | string;
  onValueChange?: (value: T) => void;
}

function isAppIdValid(value: string) {
  if (!value) return true;
  if (!/^\d{16,21}$/.test(value)) return "Must be a valid Discord game ID.";
  return true;
}

const updateRPC = debounce(() => {
  setRpc(true);
  if (isPluginEnabled(GameRPCPlugin.name)) setRpc();
});

function SingleSetting<T>({
  settingsKey,
  label,
  disabled,
  isValid,
  transform,
  onValueChange,
}: TextOption<T>) {
  const storedValue = settings.store[settingsKey] ?? "";
  const [state, setState] = useState(storedValue);
  const [error, setError] = useState<string | null>(null);
  const validationRequest = useRef(0);

  useEffect(() => {
    setState(storedValue);
  }, [storedValue]);

  async function handleChange(newValue: any) {
    if (transform) newValue = transform(newValue);

    const request = ++validationRequest.current;
    const formatValid = isValid?.(newValue) ?? true;

    setState(newValue);
    onValueChange?.(newValue);
    setError(resolveError(formatValid));

    if (formatValid !== true) return;

    if (newValue) setError("Checking game ID...");
    const valid = await validateApplicationId(newValue);
    if (request !== validationRequest.current) return;

    setError(resolveError(valid));
    if (valid !== true) return;

    settings.store[settingsKey] = newValue;
    resetTimestampStart();
    updateRPC();
  }

  return (
    <div className={cl("single", { disabled })}>
      <Heading tag="h5">{label}</Heading>
      <TextInput
        type="text"
        inputMode="numeric"
        placeholder="Enter a game ID"
        value={state}
        onChange={handleChange}
        disabled={disabled}
      />
      {!!state && (
        <Button
          color={Button.Colors.TRANSPARENT}
          onClick={() => {
            validationRequest.current++;
            settings.store[settingsKey] = "";
            setState("");
            onValueChange?.("");
            setError(null);
            updateRPC();
          }}
        >
          Clear Game ID
        </Button>
      )}
      {error && (
        <Text className={cl("error")} variant="text-sm/normal">
          {error}
        </Text>
      )}
    </div>
  );
}

function ApplicationSearch(props: { onSelect: (appID: string) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DetectableApplication[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchRequest = useRef(0);

  useEffect(() => {
    const request = ++searchRequest.current;
    if (!query.trim()) {
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }

    const timeout = setTimeout(() => {
      setLoading(true);
      setError(null);
      searchDetectableApplications(query)
        .then((applications) => {
          if (request === searchRequest.current) setResults(applications);
        })
        .catch(() => {
          if (request === searchRequest.current) {
            setResults([]);
            setError("Could not search Discord's detectable applications.");
          }
        })
        .finally(() => {
          if (request === searchRequest.current) setLoading(false);
        });
    }, 300);

    return () => clearTimeout(timeout);
  }, [query]);

  function selectApplication(application: DetectableApplication) {
    settings.store.appID = application.id;
    props.onSelect(application.id);
    resetTimestampStart();
    updateRPC();
    setQuery(application.name);
    setResults([]);
  }

  return (
    <div className={cl("search")}>
      <Heading tag="h5">Don't have a game ID, but know your game name?</Heading>
      <TextInput
        type="text"
        placeholder="Search for a game"
        value={query}
        onChange={setQuery}
      />
      {loading && <Text variant="text-sm/normal">Searching...</Text>}
      {error && (
        <Text className={cl("error")} variant="text-sm/normal">
          {error}
        </Text>
      )}
      {!loading && query.trim() && !error && results.length === 0 && (
        <Text variant="text-sm/normal">
          No matching detectable games found.
        </Text>
      )}
      {results.length > 0 && (
        <div className={cl("results")}>
          {results.map((application: DetectableApplication) => (
            <button
              className={cl("result")}
              key={application.id}
              onClick={() => selectApplication(application)}
              type="button"
            >
              <strong>{application.name}</strong>
              <span>{application.id}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TimestampSettings() {
  const currentSettings = settings.use();
  const timestampMode = currentSettings.timestampMode ?? TimestampMode.NOW;
  const [startTimeState, setStartTimeState] = useState(
    String(currentSettings.startTime ?? Date.now()),
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setStartTimeState(String(currentSettings.startTime ?? Date.now()));
  }, [currentSettings.startTime, timestampMode]);

  function updateTimestampSettings() {
    updateRPC();
  }

  function applyStartTimestamp(value: number) {
    settings.store.startTime = value;
    resetTimestampStart();
    updateTimestampSettings();
  }

  function handleStartTimestampChange(value: string) {
    setStartTimeState(value);
    const trimmed = value.trim();

    if (!trimmed) {
      setError("Enter a Unix timestamp in milliseconds.");
      return;
    }

    if (!/^\d+$/.test(trimmed)) {
      setError("Start timestamp must be a whole number of milliseconds.");
      return;
    }

    const numericValue = Number(trimmed);
    setError(null);
    applyStartTimestamp(numericValue);
  }

  function adjustTimestampBy(deltaMs: number) {
    const currentTimestamp = Number(startTimeState) || Date.now();
    const nextTimestamp = currentTimestamp + deltaMs;
    setStartTimeState(String(nextTimestamp));
    settings.store.startTime = nextTimestamp;
    resetTimestampStart();
    updateTimestampSettings();
  }

  const startTimeWarning =
    timestampMode === TimestampMode.CUSTOM_START &&
    Number(startTimeState) > Date.now()
      ? "Warning: this start timestamp is in the future and will make the elapsed time negative."
      : null;

  return (
    <div className={cl("timestamp")}>
      <Heading tag="h5">Timestamp Mode</Heading>
      <Select
        options={[
          { label: "Now", value: TimestampMode.NOW },
          { label: "Custom", value: TimestampMode.CUSTOM_START },
        ]}
        select={(value) => {
          settings.store.timestampMode = value;
          resetTimestampStart();
          updateTimestampSettings();
        }}
        isSelected={(value) => value === timestampMode}
        serialize={(value) => String(value)}
      />
      {timestampMode === TimestampMode.CUSTOM_START && (
        <>
          <TextInput
            type="text"
            inputMode="numeric"
            placeholder="Start timestamp (in miliseconds)"
            value={startTimeState}
            onChange={handleStartTimestampChange}
          />
          <div className={cl("timestamp-actions")}>
            <Button
              color={Button.Colors.TRANSPARENT}
              onClick={() => {
                const now = Date.now();
                setStartTimeState(String(now));
                applyStartTimestamp(now);
              }}
            >
              Set timestamp to now
            </Button>
            <Button
              color={Button.Colors.TRANSPARENT}
              onClick={() => adjustTimestampBy(-60_000)}
            >
              Add time passed
            </Button>
            <Button
              color={Button.Colors.TRANSPARENT}
              onClick={() => adjustTimestampBy(60_000)}
            >
              Remove time passed
            </Button>
          </div>
          <Text variant="text-sm/normal">
            Set the start time for your activity. Each time button adds or
            removes one minute from the elapsed time.
          </Text>
          {error && (
            <Text className={cl("error")} variant="text-sm/normal">
              {error}
            </Text>
          )}
          {startTimeWarning && (
            <Text className={cl("error")} variant="text-sm/normal">
              {startTimeWarning}
            </Text>
          )}
        </>
      )}
    </div>
  );
}

export function RPCSettings() {
  const currentSettings = settings.use();
  const [appID, setAppID] = useState(currentSettings.appID ?? "");

  useEffect(() => {
    setAppID(currentSettings.appID ?? "");
  }, [currentSettings.appID]);

  return (
    <div className={cl("root")}>
      <SingleSetting
        settingsKey="appID"
        label="Game ID"
        isValid={isAppIdValid}
        onValueChange={setAppID}
      />
      {!appID.trim() && <ApplicationSearch onSelect={setAppID} />}
      <TimestampSettings />
    </div>
  );
}
