import { createSignal, onCleanup, Show } from 'solid-js';
import Phaser from 'phaser';
import CatTiltScene from './game/CatTiltScene';
import { initTiltSensor, destroyTiltSensor } from './game/sensorStore';

export default function App() {
  const [started, setStarted] = createSignal(false);
  let gameContainer;
  let gameInstance = null;

  const handleStart = async () => {
    await initTiltSensor();
    try {
      if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // iOS Safari 등 Fullscreen API 미지원 환경 무시
    }
    try {
      if (screen.orientation && typeof screen.orientation.lock === 'function') {
        await screen.orientation.lock('landscape');
      }
    } catch {
      // 일부 브라우저(iOS Safari 등)에서는 orientation.lock 미지원
    }
    setStarted(true);

    if (!gameInstance && gameContainer) {
      gameInstance = new Phaser.Game({
        type: Phaser.AUTO,
        parent: gameContainer,
        width: window.innerWidth,
        height: window.innerHeight,
        backgroundColor: '#1e293b',
        pixelArt: true,
        scale: {
          mode: Phaser.Scale.RESIZE,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
        physics: {
          default: 'arcade',
          arcade: {
            gravity: { y: 800 },
            debug: false,
          },
        },
        scene: [CatTiltScene],
      });
    }
  };

  onCleanup(() => {
    destroyTiltSensor();
    if (gameInstance) {
      gameInstance.destroy(true);
      gameInstance = null;
    }
  });

  return (
    <div class="app-wrapper">
      <Show when={!started()}>
        <div class="start-overlay">
          <h1>길냥이 기울기 조작 테스트</h1>
          <p>
            스마트폰을 좌우로 기울여 고양이를 움직여 보세요.
            <br />
            (iOS는 센서 권한 허용 필요 / PC는 좌우 방향키 지원)
          </p>
          <button class="start-btn" onClick={handleStart}>
            센서 활성화 및 시작
          </button>
        </div>
      </Show>

      <div ref={gameContainer} class="game-container" />
    </div>
  );
}