import Phaser from 'phaser';
import { sensorState, consumeJumpRequest } from './sensorStore';
import leaderSprite from '../assets/leader.png';
import catJumpSprite from '../assets/cat_jump.png';

export default class CatTiltScene extends Phaser.Scene {
    constructor() {
        super('CatTiltScene');
        this.cat = null;
        this.cursors = null;
        this.spaceKey = null;
        this.debugText = null;
        this.isWallHit = false;
        this.wallHitTimer = null;
        this.prevVelocityX = 0;

        // 게임 상태 (타워 등반)
        this.worldHeight = 2000;
        this.goalPlatform = null;
        this.isCleared = false;
        this.startTime = 0;
        this.clearUI = null;

        // 조작 감도 및 물리 설정
        this.maxSpeed = 480;          // 최대 이동 속도 (기존 320의 1.5배)
        this.maxAcceleration = 960;   // 기울기/키보드 최대 가속도 (px/s^2)
        this.groundDrag = 440;        // 바닥 마찰력 (기존 대비 미끄러짐 50% 감소)
        this.airDrag = 60;            // 공중 저항
        this.wallBounceFactor = 0.65; // 점프 중 벽 충돌 시 탄성 반발 계수
        this.jumpSpeed = -520;        // 점프 초기 속도 (px/s)
        this.deadzone = 3;            // 미세 떨림 무시 각도 (±3도)
        this.maxTiltAngle = 30;       // 최대 가속에 도달하는 기울기 각도 (±30도)
    }

    preload() {
        this.load.spritesheet('cat', leaderSprite, {
            frameWidth: 100,
            frameHeight: 100,
        });
        this.load.image('cat-jump', catJumpSprite);
    }

    create() {
        const { width, height } = this.scale;
        this.isWallHit = false;
        this.isCleared = false;
        this.prevVelocityX = 0;
        this.startTime = this.time.now;

        // 세로로 긴 월드 및 카메라 경계 설정
        this.physics.world.setBounds(0, 0, width, this.worldHeight);
        this.cameras.main.setBounds(0, 0, width, this.worldHeight);

        // 바닥 생성
        const groundY = this.worldHeight - 40;
        const ground = this.add.rectangle(width / 2, groundY, width, 80, 0x334155);
        this.physics.add.existing(ground, true);

        // 랜덤 발판 생성 (바닥부터 꼭대기까지 점프로 도달 가능한 간격)
        const platforms = this.physics.add.staticGroup();
        let currentY = groundY - 125;
        let prevX = width / 2;
        let prevWasNarrow = true; // 첫 발판은 일반 발판으로 시작
        let narrowCount = 0;
        const maxNarrowPlatforms = 2;
        const goalY = 160;

        while (currentY > goalY + 115) {
            const isNarrow =
                narrowCount < maxNarrowPlatforms &&
                !prevWasNarrow &&
                Math.random() < 0.3;
            const platWidth = isNarrow
                ? Phaser.Math.Between(65, 92)
                : Phaser.Math.Between(126, 195);
            const minX = platWidth / 2 + 24;
            const maxX = width - platWidth / 2 - 24;

            // 이전 발판에서 점프로 도달 가능한 수평 거리 내에서 랜덤 배치
            const offset = Phaser.Math.Between(110, 260) * (Math.random() < 0.5 ? -1 : 1);
            let nextX = Phaser.Math.Clamp(prevX + offset, minX, maxX);
            if (Math.abs(nextX - prevX) < 80) {
                nextX = Phaser.Math.Clamp(prevX - offset, minX, maxX);
            }

            const plat = this.add.rectangle(nextX, currentY, platWidth, 13, 0x64748b);
            plat.setStrokeStyle(2, 0x94a3b8);
            this.physics.add.existing(plat, true);
            // 아래에서 위로 통과 가능한 원웨이(One-way) 발판
            plat.body.checkCollision.down = false;
            plat.body.checkCollision.left = false;
            plat.body.checkCollision.right = false;
            platforms.add(plat);

            if (isNarrow) {
                narrowCount += 1;
            }
            prevX = nextX;
            prevWasNarrow = isNarrow;
            currentY -= Phaser.Math.Between(95, 125);
        }

        // 꼭대기 목표 발판 생성
        const goalWidth = 210;
        const goalX = Phaser.Math.Clamp(
            prevX + Phaser.Math.Between(-180, 180),
            goalWidth / 2 + 20,
            width - goalWidth / 2 - 20
        );
        const goalPlat = this.add.rectangle(goalX, goalY, goalWidth, 15, 0xf59e0b);
        goalPlat.setStrokeStyle(3, 0xfef08a);
        this.physics.add.existing(goalPlat, true);
        goalPlat.body.checkCollision.down = false;
        goalPlat.body.checkCollision.left = false;
        goalPlat.body.checkCollision.right = false;
        this.goalPlatform = goalPlat;

        this.add.text(goalX, goalY - 34, '🏁 GOAL', {
            fontSize: '18px',
            fontStyle: 'bold',
            fill: '#fef08a',
        }).setOrigin(0.5);

        // 고양이 애니메이션 등록 (1프레임: idle, 2~3프레임: walk)
        if (!this.anims.exists('cat-idle')) {
            this.anims.create({
                key: 'cat-idle',
                frames: [{ key: 'cat', frame: 0 }],
                frameRate: 1,
                repeat: -1,
            });
        }

        if (!this.anims.exists('cat-walk')) {
            this.anims.create({
                key: 'cat-walk',
                frames: this.anims.generateFrameNumbers('cat', { start: 1, end: 2 }),
                frameRate: 8,
                repeat: -1,
            });
        }

        if (!this.anims.exists('cat-wall-hit')) {
            this.anims.create({
                key: 'cat-wall-hit',
                frames: [{ key: 'cat', frame: 4 }],
                frameRate: 1,
                repeat: 0,
            });
        }

        if (!this.anims.exists('cat-jump')) {
            this.anims.create({
                key: 'cat-jump',
                frames: [{ key: 'cat-jump' }],
                frameRate: 1,
                repeat: 0,
            });
        }

        // 고양이 스프라이트 배치 (바닥 위 시작)
        this.cat = this.physics.add.sprite(width / 2, groundY - 90, 'cat', 0);
        this.cat.setScale(0.7);
        this.cat.setCollideWorldBounds(true);
        this.cat.body.onWorldBounds = true;
        this.cat.body.setSize(56, 80).setOffset(22, 16);
        this.cat.setMaxVelocity(this.maxSpeed, 1000);
        this.cat.setDragX(this.groundDrag);
        this.cat.setBounce(0.15, 0.1);
        this.cat.play('cat-idle');

        // 카메라가 고양이를 부드럽게 추적
        this.cameras.main.startFollow(this.cat, true, 0.1, 0.15);

        // 좌우 벽 충돌 시 5번 프레임(index 4)을 표시 후 idle 복귀
        // 점프(공중) 중 벽에 부딪히면 충돌 속도에 비례해 탄성으로 튕겨남
        this.physics.world.on('worldbounds', (body, up, down, left, right) => {
            if (body.gameObject === this.cat && (left || right)) {
                const isAirborne = !this.cat.body.blocked.down;
                if (isAirborne && Math.abs(this.prevVelocityX) > 20) {
                    const bounceVx = -this.prevVelocityX * this.wallBounceFactor;
                    this.cat.setVelocityX(bounceVx);
                }

                if (!this.isWallHit) {
                    this.isWallHit = true;
                    this.cat.anims.play('cat-wall-hit', true);

                    if (this.wallHitTimer) {
                        this.wallHitTimer.remove(false);
                    }
                    this.wallHitTimer = this.time.delayedCall(200, () => {
                        this.isWallHit = false;
                        this.cat.anims.play('cat-idle', true);
                    });
                }
            }
        });

        // 바닥, 일반 발판, 목표 발판 충돌 설정
        this.physics.add.collider(this.cat, ground);
        this.physics.add.collider(this.cat, platforms);
        this.physics.add.collider(this.cat, goalPlat, () => {
            if (!this.isCleared && this.cat.body.blocked.down) {
                this.handleClear();
            }
        });

        // PC 테스트용 키보드 입력
        this.cursors = this.input.keyboard.createCursorKeys();
        this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

        // 디버그 & 진행도 HUD (카메라 고정)
        this.debugText = this.add.text(16, 16, '', {
            fontSize: '14px',
            fill: '#f8fafc',
            backgroundColor: 'rgba(0, 0, 0, 0.45)',
            padding: { x: 8, y: 6 },
        }).setScrollFactor(0).setDepth(20);
    }

    handleClear() {
        this.isCleared = true;
        this.cat.setAccelerationX(0);
        this.cat.setVelocity(0, 0);
        this.cat.anims.play('cat-idle', true);

        const elapsed = ((this.time.now - this.startTime) / 1000).toFixed(1);
        const { width, height } = this.scale;

        const overlay = this.add
            .rectangle(width / 2, height / 2, width, height, 0x0f172a, 0.72)
            .setScrollFactor(0)
            .setDepth(30);

        const title = this.add
            .text(width / 2, height / 2 - 42, '🎉 꼭대기 도착!', {
                fontSize: '30px',
                fontStyle: 'bold',
                fill: '#fef08a',
            })
            .setOrigin(0.5)
            .setScrollFactor(0)
            .setDepth(31);

        const subtitle = this.add
            .text(width / 2, height / 2 + 4, `클리어 시간: ${elapsed}초`, {
                fontSize: '18px',
                fill: '#f8fafc',
            })
            .setOrigin(0.5)
            .setScrollFactor(0)
            .setDepth(31);

        const retryBtn = this.add
            .text(width / 2, height / 2 + 60, '다시 하기', {
                fontSize: '18px',
                fontStyle: 'bold',
                fill: '#0f172a',
                backgroundColor: '#fbbf24',
                padding: { x: 22, y: 10 },
            })
            .setOrigin(0.5)
            .setScrollFactor(0)
            .setDepth(31)
            .setInteractive({ useHandCursor: true });

        retryBtn.on('pointerdown', () => {
            this.scene.restart();
        });

        this.clearUI = [overlay, title, subtitle, retryBtn];
    }

    update() {
        if (this.isCleared) {
            if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
                this.scene.restart();
            }
            return;
        }

        let accelX = 0;

        // 1) 스마트폰 기울기 조작 우선
        if (sensorState.enabled && Math.abs(sensorState.gamma) > this.deadzone) {
            const clampedTilt = Phaser.Math.Clamp(
                sensorState.gamma,
                -this.maxTiltAngle,
                this.maxTiltAngle
            );
            const normalized = clampedTilt / this.maxTiltAngle;
            accelX = normalized * this.maxAcceleration;
        }

        // 2) PC 키보드 폴백 조작
        if (this.cursors.left.isDown) {
            accelX = -this.maxAcceleration;
        } else if (this.cursors.right.isDown) {
            accelX = this.maxAcceleration;
        }

        // 점프 입력 (모바일 흔들림 또는 PC 스페이스바/위쪽 화살표)
        const shakeJump = consumeJumpRequest();
        const keyJump =
            Phaser.Input.Keyboard.JustDown(this.cursors.up) ||
            Phaser.Input.Keyboard.JustDown(this.spaceKey);
        const isGrounded = this.cat.body.blocked.down;

        if (isGrounded && (shakeJump || keyJump)) {
            this.cat.setVelocityY(this.jumpSpeed);
        }

        // 바닥/공중 마찰력 및 가속도 적용
        this.cat.setDragX(isGrounded ? this.groundDrag : this.airDrag);
        this.cat.setAccelerationX(accelX);

        const velocityX = this.cat.body.velocity.x;
        this.prevVelocityX = velocityX;

        // 방향 반전 및 애니메이션 전환
        if (!this.isWallHit) {
            const blockedLeft = accelX < 0 && this.cat.body.blocked.left;
            const blockedRight = accelX > 0 && this.cat.body.blocked.right;

            if (velocityX < -10) {
                this.cat.setFlipX(false);
            } else if (velocityX > 10) {
                this.cat.setFlipX(true);
            }

            if (!this.cat.body.blocked.down) {
                this.cat.anims.play('cat-jump', true);
            } else if (Math.abs(velocityX) > 10 && !blockedLeft && !blockedRight) {
                this.cat.anims.play('cat-walk', true);
            } else {
                this.cat.anims.play('cat-idle', true);
            }
        }

        // 디버그 & 진행도 텍스트 갱신
        const startY = this.worldHeight - 130;
        const goalY = this.goalPlatform ? this.goalPlatform.y : 160;
        const progress = Phaser.Math.Clamp(
            Math.round(((startY - this.cat.y) / (startY - goalY)) * 100),
            0,
            100
        );

        this.debugText.setText([
            `진행도: ${progress}%`,
            `상태: ${sensorState.statusText}`,
            `기울기: ${sensorState.gamma.toFixed(1)}° | 속도: ${Math.round(velocityX)} px/s`,
        ]);
    }
}