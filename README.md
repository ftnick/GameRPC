<h1 align="center">GameRPC</h1>

<p align="center">
  A Vencord userplugin for setting your Discord activity using Discord's detectable app list.
</p>

<p align="center">
  <a href="https://github.com/ftnick/GameRPC/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/ftnick/GameRPC" alt="License">
  </a>
  <a href="https://github.com/ftnick/GameRPC/commits/main">
    <img src="https://img.shields.io/github/last-commit/ftnick/GameRPC" alt="Last commit">
  </a>
</p>

> [!NOTE]
> GameRPC is based on the [customRPC](https://github.com/Vendicated/Vencord/tree/main/src/plugins/customRPC) plugin, with changes focused on making it easier to select a real, Discord-detectable game and automatically load its app details.

This is **not a full custom RPC editor**. It provides a quick way to set a Discord-detectable game as your activity without manually finding the correct game title, ID, or logo.

GameRPC also **does not spoof Discord Orbs Game Quests**. These quests check whether the game is actually running as a process on your computer. GameRPC only changes your Discord activity and does not launch or run the selected game.

## Screenshots

### Settings

... Yeah

<p align="center">
  <img width="500" src="https://github.com/user-attachments/assets/9eb29653-8122-4945-8c16-df1e868f200d" />
</p>

### Game ID & activity preview

Enter a game's ID to load its details. The preview shows how the game will appear on your profile.

<p align="center">
  <img width="500" src="https://github.com/user-attachments/assets/8a00d876-3f02-40b6-bb20-c64d453b13e5" />
</p>

### Search by game name

You can also search by name instead of finding the ID yourself. It lists matching games along with their IDs so you can select the one you want.

<p align="center">
  <img width="500" src="https://github.com/user-attachments/assets/c7845575-04c5-436a-8e3b-7457a4781893" />
</p>

### Special game integrations

Some games have additional integration for Discord RPC. For example, VRChat will automatically add buttons on the activity.

<p align="center">
  <img width="500" src="https://github.com/user-attachments/assets/3e3e8683-e95a-4329-922f-7b2db7b85dde" />
</p>

## Installation

### Option A — Git submodule

From the root of your Vencord folder:

```bash
git submodule add -f https://github.com/ftnick/GameRPC src/userplugins/GameRPC
```

To update the plugin later:

```bash
git submodule update --remote
```

### Option B — Clone directly

From the root of your Vencord folder:

```bash
git clone https://github.com/ftnick/GameRPC src/userplugins/GameRPC
```
