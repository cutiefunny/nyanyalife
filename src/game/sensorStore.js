export const sensorState = {
    enabled: false,
    gamma: 0, // 화면 방향을 반영한 좌우 기울기 (-90 ~ 90)
    jumpRequested: false,
    statusText: '대기 중',
};

const SHAKE_THRESHOLD = 14; // 흔들림 감지 임계값 (m/s^2)
const SHAKE_COOLDOWN_MS = 450; // 연속 점프 방지 쿨다운
let lastShakeTime = 0;
let lastAccel = null;

function getScreenAngle() {
    if (screen.orientation && typeof screen.orientation.angle === 'number') {
        return screen.orientation.angle;
    }
    return typeof window.orientation === 'number' ? window.orientation : 0;
}

function handleOrientation(event) {
    const angle = getScreenAngle();

    // 가로 모드에서는 beta 축이 좌우 기울기 역할을 함
    if (angle === 90 && event.beta !== null) {
        sensorState.gamma = event.beta;
    } else if ((angle === 270 || angle === -90) && event.beta !== null) {
        sensorState.gamma = -event.beta;
    } else if (event.gamma !== null) {
        sensorState.gamma = event.gamma;
    }
}

function handleMotion(event) {
    const now = performance.now();
    if (now - lastShakeTime < SHAKE_COOLDOWN_MS) {
        return;
    }

    let magnitude = 0;
    const acc = event.acceleration;
    if (acc && (acc.x !== null || acc.y !== null || acc.z !== null)) {
        magnitude = Math.hypot(acc.x || 0, acc.y || 0, acc.z || 0);
    } else if (event.accelerationIncludingGravity) {
        const g = event.accelerationIncludingGravity;
        const curr = { x: g.x || 0, y: g.y || 0, z: g.z || 0 };
        if (lastAccel) {
            magnitude = Math.hypot(
                curr.x - lastAccel.x,
                curr.y - lastAccel.y,
                curr.z - lastAccel.z
            );
        }
        lastAccel = curr;
    }

    if (magnitude > SHAKE_THRESHOLD) {
        sensorState.jumpRequested = true;
        lastShakeTime = now;
    }
}

export function consumeJumpRequest() {
    if (sensorState.jumpRequested) {
        sensorState.jumpRequested = false;
        return true;
    }
    return false;
}

export async function initTiltSensor() {
    if (typeof DeviceOrientationEvent === 'undefined') {
        sensorState.statusText = '센서 미지원 기기 (키보드 사용)';
        return sensorState.statusText;
    }

    // iOS 13+ Safari 권한 요청 분기
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        try {
            const permission = await DeviceOrientationEvent.requestPermission();
            if (permission === 'granted') {
                window.addEventListener('deviceorientation', handleOrientation);
                sensorState.enabled = true;
                sensorState.statusText = 'iOS 센서 활성';
            } else {
                sensorState.statusText = '센서 권한 거부됨';
            }

            if (
                typeof DeviceMotionEvent !== 'undefined' &&
                typeof DeviceMotionEvent.requestPermission === 'function'
            ) {
                const motionPermission = await DeviceMotionEvent.requestPermission();
                if (motionPermission === 'granted') {
                    window.addEventListener('devicemotion', handleMotion);
                }
            }
        } catch (err) {
            console.error(err);
            sensorState.statusText = '권한 요청 오류 (HTTPS 확인)';
        }
    } else {
        // Android Chrome 및 기타 브라우저
        window.addEventListener('deviceorientation', handleOrientation);
        if (typeof DeviceMotionEvent !== 'undefined') {
            window.addEventListener('devicemotion', handleMotion);
        }
        sensorState.enabled = true;
        sensorState.statusText = '센서 활성';
    }

    return sensorState.statusText;
}

export function destroyTiltSensor() {
    window.removeEventListener('deviceorientation', handleOrientation);
    window.removeEventListener('devicemotion', handleMotion);
    sensorState.enabled = false;
    sensorState.gamma = 0;
    sensorState.jumpRequested = false;
    lastAccel = null;
}