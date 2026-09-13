# GameRPC

Enter a Discord game ID and GameRPC looks it up through Discord's detectable applications API, then displays the game's name as your Rich Presence while preserving its application identity.

> [!NOTE]
> This plugin is based on the [customRPC](https://github.com/Vendicated/Vencord/tree/main/src/plugins/customRPC) plugin, with modifications. All credit for the original implementation goes to the contributors and Vencord team.

*This plugin will **not** spoof Discord Orbs Game Quests. Those quests detect whether the game is actually running as a process on your computer, this plugin only sets your activity, it doesn't launch or run the game itself, so the quest won't recognize it.*

## Installation

### A. Add as a submodule

From the root of your Vencord folder:

```bash
git submodule add -f https://github.com/ftnick/GameRPC src/userplugins/GameRPC
```

Using a submodule means you can pull future updates just by running `git submodule update --remote` later, instead of re-cloning.

### B. Add via plain clone

If you don't want to deal with submodules, just clone it directly into `userplugins`:

```bash
git clone https://github.com/ftnick/GameRPC src/userplugins/GameRPC
```
