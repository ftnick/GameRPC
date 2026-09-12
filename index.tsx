/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2023 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { definePluginSettings } from "@api/Settings";
import { getUserSettingLazy } from "@api/UserSettings";
import { Divider } from "@components/Divider";
import { ErrorCard } from "@components/ErrorCard";
import { Flex } from "@components/Flex";
import { Logger } from "@utils/Logger";
import { Margins } from "@utils/margins";
import { classes } from "@utils/misc";
import { useAwaiter } from "@utils/react";
import definePlugin, { OptionType } from "@utils/types";
import { Activity } from "@vencord/discord-types";
import { ActivityType } from "@vencord/discord-types/enums";
import { findByCodeLazy, findComponentByCodeLazy } from "@webpack";
import {
  Button,
  FluxDispatcher,
  Forms,
  React,
  UserStore,
} from "@webpack/common";

import { RPCSettings } from "./RpcSettings";

const useProfileThemeStyle = findByCodeLazy(
  "profileThemeStyle:",
  "--profile-gradient-primary-color",
);
const ActivityView = findComponentByCodeLazy(
  ".party?(0",
  "USER_PROFILE_ACTIVITY",
);

const ShowCurrentGame = getUserSettingLazy<boolean>(
  "status",
  "showCurrentGame",
)!;
const logger = new Logger("GameRPC");

export interface DetectableApplication {
  id: string;
  name: string;
}

export const enum TimestampMode {
  NOW,
}

export const settings = definePluginSettings({
  config: {
    type: OptionType.COMPONENT,
    component: RPCSettings,
  },
}).withPrivateSettings<{
  appID?: string;
}>();

let detectableApplications: Promise<DetectableApplication[]> | undefined;

function getDetectableApplications() {
  detectableApplications ??= fetch(
    "https://discord.com/api/v10/applications/detectable",
    { credentials: "include" },
  ).then(async (response) => {
    if (!response.ok)
      throw new Error(`Discord API returned ${response.status}`);
    const data = (await response.json()) as DetectableApplication[];
    logger.info("Fetched application data:", data);
    return data;
  });

  return detectableApplications;
}

export async function validateApplicationId(
  appID: string,
): Promise<true | string> {
  if (!appID) return true;

  try {
    const application = (await getDetectableApplications()).find(
      (app) => app.id === appID,
    );
    return application ? true : "This game ID is not valid or detectable.";
  } catch {
    return "Could not verify this game ID with Discord.";
  }
}

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function levenshteinSimilarity(left: string, right: string) {
  if (left === right) return 1;
  if (!left.length || !right.length) return 0;

  const previous = Array.from({ length: right.length + 1 }, (_, i) => i);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex++) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex++) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] +
          (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }

  return 1 - previous[right.length] / Math.max(left.length, right.length);
}

function containsInOrder(value: string, query: string) {
  let queryIndex = 0;
  for (const character of value) {
    if (character === query[queryIndex]) queryIndex++;
    if (queryIndex === query.length) return true;
  }
  return false;
}

function scoreApplication(application: DetectableApplication, query: string) {
  const name = normalizeSearchText(application.name);
  const queryTokens = query.match(/[a-z0-9]+/g) ?? [];
  const nameTokens = application.name.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  let score = 0;

  if (name === query) score += 1000;
  if (name.startsWith(query)) score += 700;
  if (name.includes(query)) score += 550;
  if (containsInOrder(name, query)) score += 180;
  score += levenshteinSimilarity(name, query) * 250;

  for (const queryToken of queryTokens) {
    const matchingToken = nameTokens.find(
      (nameToken) =>
        nameToken === queryToken ||
        nameToken.startsWith(queryToken) ||
        nameToken.includes(queryToken),
    );
    if (matchingToken) score += matchingToken === queryToken ? 450 : 250;
  }

  return score;
}

export async function searchDetectableApplications(query: string) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return [];

  const applications = await getDetectableApplications();
  return applications
    .map((application) => ({
      application,
      score: scoreApplication(application, normalizedQuery),
    }))
    .filter(({ score }) => score >= 150)
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.application.name.localeCompare(right.application.name),
    )
    .slice(0, 8)
    .map(({ application }) => application);
}

async function createActivity(): Promise<Activity | undefined> {
  const appID = settings.store.appID;
  if (!appID) return;

  let application: DetectableApplication | undefined;
  try {
    application = (await getDetectableApplications()).find(
      (app) => app.id === appID,
    );
  } catch (err) {
    logger.error("Failed to fetch RPC data", err);
    return;
  }

  if (!application) {
    logger.error("Game ID was not found in detectable applications", appID);
    return;
  }

  const activity: Activity = {
    application_id: application.id,
    name: application.name,
    type: ActivityType.PLAYING,
    flags: 1 << 0,
  };

  const timestampMode = TimestampMode.NOW;
  switch (timestampMode) {
    case TimestampMode.NOW:
      activity.timestamps = {
        start: Date.now(),
      };
      break;
  }

  return activity;
}

export async function setRpc(disable?: boolean) {
  if (disable) {
    FluxDispatcher.dispatch({
      type: "LOCAL_ACTIVITY_UPDATE",
      activity: null,
      socketId: "GameRPC",
    });
    return;
  }

  const activity: Activity | undefined = await createActivity();

  FluxDispatcher.dispatch({
    type: "LOCAL_ACTIVITY_UPDATE",
    activity,
    socketId: "GameRPC",
  });
}

export default definePlugin({
  name: "GameRPC",
  description:
    "Show a detectable game as your Rich Presence by entering its ID.",
  tags: ["Activity", "Customisation"],
  authors: [
    {
      name: "ftnick",
      id: 701632642822701057n,
    },
  ],
  dependencies: ["UserSettingsAPI"],
  // This plugin's patch is not important for functionality, so don't require a restart
  requiresRestart: false,
  settings,

  start: setRpc,
  stop: () => setRpc(true),

  // Discord hides buttons on your own Rich Presence for some reason. This patch disables that behaviour
  patches: [
    {
      find: ".USER_PROFILE_ACTIVITY_BUTTONS),",
      replacement: {
        match: /.getId\(\)===\i.id/,
        replace: "$& && false",
      },
    },
  ],

  settingsAboutComponent: () => {
    const [activity] = useAwaiter(createActivity, {
      fallbackValue: undefined,
      deps: Object.values(settings.store),
    });
    const gameActivityEnabled = ShowCurrentGame.useSetting();
    const { profileThemeStyle } = useProfileThemeStyle({});

    return (
      <>
        {!gameActivityEnabled && (
          <ErrorCard
            className={classes(Margins.top16, Margins.bottom16)}
            style={{ padding: "1em" }}
          >
            <Forms.FormTitle>Notice</Forms.FormTitle>
            <Forms.FormText>
              Activity Sharing isn't enabled, people won't be able to see your
              game rich presence!
            </Forms.FormText>

            <Button
              color={Button.Colors.TRANSPARENT}
              className={Margins.top8}
              onClick={() => ShowCurrentGame.updateSetting(true)}
            >
              Enable
            </Button>
          </ErrorCard>
        )}

        {/* 
        <Flex flexDirection="column" gap=".5em" className={Margins.top16}>
          <Forms.FormText>
            hi
          </Forms.FormText>
        </Flex>

        <Divider className={Margins.top8} />
        */}

        <div
          style={{
            width: "284px",
            ...profileThemeStyle,
            marginTop: 8,
            borderRadius: 8,
            background: "var(--background-mod-muted)",
          }}
        >
          {activity && (
            <ActivityView
              activity={activity}
              user={UserStore.getCurrentUser()}
              currentUser={UserStore.getCurrentUser()}
            />
          )}
        </div>
      </>
    );
  },
});
