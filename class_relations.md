| ファイル | Imports | Classes | SuperClasses |
|---|---|---|---|
| eslint.config.js | @eslint/js, eslint-plugin-import |  |  |
| extract_meta5.js |  |  |  |
| extract_meta6.js |  |  |  |
| generate_class_graph.js |  |  |  |
| assets/js/AppRoot.js | ./core/GameConfig.js, ./core/Engine.js, ./scenes/SceneManager.js, ./scenes/SceneFactory.js, ./input/CombinedInputHandler.js, ./input/inputHandler.js, ./audio/globalSoundManager.js, ./audio/BGMManager.js, ./utils/StatsManager.js, ./utils/DisplayManager.js, ./utils/WallpaperController.js, ./utils/perfStats.js, ./utils/AppInitializer.js, ./utils/EventBus.js | AppRoot |  |
| assets/js/audio/BGMManager.js | ./globalSoundManager.js | BGMManager |  |
| assets/js/audio/globalSoundManager.js | ./soundManager.js |  |  |
| assets/js/audio/soundManager.js |  | SoundManager |  |
| assets/js/core/Engine.js | ./GameConfig.js | Engine |  |
| assets/js/core/GameConfig.js |  | GameConfig |  |
| assets/js/core/GameState.js |  | GameState |  |
| assets/js/core/Scene.js |  | Scene |  |
| assets/js/core/Scene_dummy.js |  | Scene_dummy |  |
| assets/js/input/CombinedInputHandler.js | ./inputHandler.js, ./keyboard.js, ./gamepad.js | CombinedInputHandler | InputHandler |
| assets/js/input/gamepad.js | ./inputHandler.js | GamepadInputHandler | InputHandler |
| assets/js/input/inputHandler.js |  | InputHandler |  |
| assets/js/input/keyboard.js | ./inputHandler.js | KeyboardInputHandler | InputHandler |
| assets/js/main.js | ./AppRoot.js |  |  |
| assets/js/resources/tetrominoes.js |  |  |  |
| assets/js/resources/wallImages.js |  |  |  |
| assets/js/scenes/GameplayScene.js | ../core/Scene.js, ../core/GameConfig.js, ../core/GameState.js, ../resources/tetrominoes.js, ../audio/globalSoundManager.js, ../input/inputHandler.js, ../utils/EventBus.js, ../utils/StatsManager.js, ../resources/wallImages.js | GameplayScene, GameplayScene | Scene, Scene |
| assets/js/scenes/SceneFactory.js | ./TitleScene.js, ./GameplayScene.js, ./SettingsScene.js | SceneFactory |  |
| assets/js/scenes/SceneManager.js |  | SceneManager |  |
| assets/js/scenes/SettingsScene.js | ../core/Scene.js, ../input/inputHandler.js, ../core/GameConfig.js | SettingsScene, SettingsScene | Scene, Scene |
| assets/js/scenes/TitleScene.js | ../core/Scene.js, ../input/inputHandler.js, ../utils/EventBus.js | TitleScene, TitleScene | Scene, Scene |
| assets/js/utils/AppInitializer.js |  | AppInitializer |  |
| assets/js/utils/DisplayManager.js | ./StatsManager.js | ViewBase, StatsView, DebugView, DisplayManager | ViewBase, ViewBase |
| assets/js/utils/DisplayManager_old.js | ./StatsManager.js | StatsView, DebugView, DisplayManager |  |
| assets/js/utils/EventBus.js |  | EventBusClass |  |
| assets/js/utils/MenuController.js |  | MenuController |  |
| assets/js/utils/perfStats.js |  | PerfStats |  |
| assets/js/utils/StatsManager.js | ./EventBus.js | StatsManagerClass |  |
| assets/js/utils/WallpaperController.js | ./EventBus.js | WallpaperController |  |
