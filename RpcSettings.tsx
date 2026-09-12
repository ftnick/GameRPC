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
import { Text, TextInput, useEffect, useRef, useState } from "@webpack/common";

import GameRPCPlugin, {
  searchDetectableApplications,
  setRpc,
  settings,
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
  }, [query]);

  function selectApplication(application: DetectableApplication) {
    settings.store.appID = application.id;
    props.onSelect(application.id);
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
    </div>
  );
}
