/**
 * VeriWave - デジタル波形ビューアー
 * 
 * このアプリケーションは、デジタル信号の波形を描画し、
 * WaveDromやSystemVerilogテストベンチを生成するためのツールです。
 * 
 * 主な機能:
 * - リアルタイム波形描画
 * - ズーム・スクロール機能
 * - マウスによる波形編集
 * - WaveDrom形式でのエクスポート
 * - SystemVerilogテストベンチ生成
 * - テーマ切り替え
 * 
 * 作者: AI Assistant (with a sense of humor)
 * バージョン: 2.0 (Improved & Commented)
 */

document.addEventListener('DOMContentLoaded', () => {
    // ========================================
    // DOM要素の取得（キャッシュしてパフォーマンス向上）
    // ========================================
    const elements = {
        // メインコンテナ
        signalList: document.getElementById('signal-list'),
        addSignalBtn: document.getElementById('add-signal-btn'),
        
        // キャンバス要素（波形描画用）
        canvas: document.getElementById('timing-chart-canvas'),
        timeAxisCanvas: document.getElementById('time-axis-canvas'),
        
        // 設定要素
        timeUnitSelect: document.getElementById('time-unit'),
        timeStepsInput: document.getElementById('time-steps'),
        
        // 出力ボタン
        wavedromBtn: document.getElementById('wavedrom-btn'),
        svTestbenchBtn: document.getElementById('sv-testbench-btn'),
        
        // 出力エリア
        wavedromOutput: document.getElementById('wavedrom-output'),
        svTestbenchOutput: document.getElementById('sv-testbench-output'),
        
        // コピーボタン
        copyWavedromBtn: document.getElementById('copy-wavedrom-btn'),
        copySvBtn: document.getElementById('copy-sv-btn'),
        
        // テーマ切り替え
        themeSwitcherBtn: document.getElementById('theme-switcher')
    };

    // キャンバスコンテキストの取得（一度だけ取得して再利用）
    const ctx = elements.canvas.getContext('2d');
    const timeCtx = elements.timeAxisCanvas.getContext('2d');

    // ========================================
    // 定数とグローバル状態
    // ========================================
    
    // 描画設定
    const DRAWING_CONFIG = {
        signalHeight: 40,        // 各信号の高さ（px）
        minCanvasHeight: 200,    // キャンバスの最小高さ
        minGridStep: 20,         // 最小グリッドステップ
        maxGridStep: 100,        // 最大グリッドステップ
        targetWidth: 1200,       // 目標キャンバス幅
        labelSpacing: 80,        // ラベル間隔
        zoomRange: { min: 0.5, max: 3.0 }, // ズーム範囲
        scrollStep: 50           // スクロールステップ
    };

    // 時間設定
    const TIME_CONFIG = {
        units: {
            ns: { scale: 10, multiplier: 1e-9 },
            us: { scale: 1, multiplier: 1e-6 },
            ms: { scale: 0.1, multiplier: 1e-3 }
        },
        defaultUnit: 'ns',
        defaultScale: 10
    };

    // アプリケーション状態
    const state = {
        timeUnit: TIME_CONFIG.defaultUnit,
        timeScale: TIME_CONFIG.defaultScale,
        timeSteps: parseInt(elements.timeStepsInput.value, 10),
        zoomLevel: 1.0,
        scrollOffset: 0,
        isDragging: false,
        isDrawing: false,
        lastMouseX: 0,
        currentBusValue: null
    };

    // 信号データ（アプリケーションの心臓部）
    let signals = [
        { 
            name: 'clk', 
            type: 'clk', 
            wave: Array(state.timeSteps).fill(null), 
            width: 1, 
            freq: 50 
        },
        { 
            name: 'rst_n', 
            type: 'binary', 
            wave: Array(state.timeSteps).fill(null), 
            width: 1 
        }
    ];

    // ========================================
    // ユーティリティ関数
    // ========================================

    /**
     * グリッドステップを動的に計算
     * Stepsの値に応じて最適なグリッド間隔を決定
     * 小さすぎると見づらい、大きすぎると無駄なスペース
     * 
     * @param {number} timeSteps - 時間ステップ数
     * @returns {number} 計算されたグリッドステップ
     */
    function calculateGridStep(timeSteps) {
        const { minGridStep, maxGridStep, targetWidth } = DRAWING_CONFIG;
        const calculatedStep = Math.max(minGridStep, Math.min(maxGridStep, targetWidth / timeSteps));
        return Math.floor(calculatedStep);
    }

    /**
     * 通知を表示する関数
     * ユーザーに何が起こったかを教えてくれる親切な関数
     * 
     * @param {string} message - 表示するメッセージ
     * @param {string} type - 通知タイプ ('info', 'warning', 'error')
     */
    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // スタイル設定（インラインで即座に適用）
        const styles = {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '10px 15px',
            borderRadius: '4px',
            color: 'white',
            fontWeight: 'bold',
            zIndex: '1000',
            animation: 'slideIn 0.3s ease'
        };

        // タイプ別の色設定
        const colors = {
            error: '#dc3545',
            warning: '#ffc107',
            info: '#007acc'
        };

        styles.backgroundColor = colors[type] || colors.info;
        if (type === 'warning') styles.color = '#000';

        Object.assign(notification.style, styles);
        
        document.body.appendChild(notification);
        
        // 3秒後に自動削除
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    // ========================================
    // 波形生成・管理
    // ========================================

    /**
     * 波形データを初期化
     * Stepsが変更された時に既存データを保持しながら新しい配列を作成
     * データの移行は慎重に行う（ユーザーの作業を無駄にしないため）
     */
    function initializeWaves() {
        const newTimeSteps = parseInt(elements.timeStepsInput.value, 10);
        
        signals.forEach(signal => {
            const oldWave = signal.wave;
            const oldData = signal.data;
            
            // 新しい配列を作成
            signal.wave = Array(newTimeSteps).fill(null);
            if (signal.type === 'bus') {
                signal.data = Array(newTimeSteps).fill('');
            }
            
            // 既存データを新しい配列にコピー（データ保護）
            if (oldWave && oldWave.length > 0) {
                const copyLength = Math.min(oldWave.length, newTimeSteps);
                for (let i = 0; i < copyLength; i++) {
                    signal.wave[i] = oldWave[i];
                }
            }
            
            if (signal.type === 'bus' && oldData && oldData.length > 0) {
                const copyLength = Math.min(oldData.length, newTimeSteps);
                for (let i = 0; i < copyLength; i++) {
                    signal.data[i] = oldData[i];
                }
            }
        });
        
        state.timeSteps = newTimeSteps;
        generateAllClockWaves();
    }

    /**
     * すべてのクロック信号を生成
     * クロック信号は自動生成される（手動で描く必要がない）
     */
    function generateAllClockWaves() {
        signals.forEach(signal => {
            if (signal.type === 'clk' && signal.freq) {
                generateClockWave(signal);
            }
        });
    }

    /**
     * 個別のクロック波形を生成
     * 周波数から周期を計算し、適切なタイミングで信号を反転
     * 
     * @param {Object} clkSignal - クロック信号オブジェクト
     */
    function generateClockWave(clkSignal) {
        const freqHz = clkSignal.freq * 1e6; // MHz → Hz
        const periodSeconds = 1 / freqHz;
        
        // 時間単位に応じた乗数を取得
        const unitConfig = TIME_CONFIG.units[state.timeUnit];
        const periodInTimeUnits = periodSeconds / unitConfig.multiplier;
        const periodInGridSteps = periodInTimeUnits / state.timeScale;
        const halfPeriodInGridSteps = periodInGridSteps / 2;
        
        // 無効な周期の場合は0で埋める
        if (halfPeriodInGridSteps <= 0) {
            clkSignal.wave.fill(0);
            return;
        }

        // クロック波形を生成（0と1を交互に）
        let value = 0;
        let counter = 0;
        for (let i = 0; i < state.timeSteps; i++) {
            clkSignal.wave[i] = value;
            counter++;
            if (counter >= halfPeriodInGridSteps) {
                value = 1 - value; // 0 ↔ 1 の切り替え
                counter = 0;
            }
        }
    }

    // ========================================
    // UI描画・管理
    // ========================================

    /**
     * 信号リストを描画
     * 各信号の設定UIを動的に生成
     * アクセシビリティにも配慮（ARIA属性、キーボードナビゲーション）
     */
    function renderSignalList() {
        elements.signalList.innerHTML = '';
        
        signals.forEach((signal, index) => {
            const signalRow = createSignalRow(signal, index);
            elements.signalList.appendChild(signalRow);
        });
    }

    /**
     * 個別の信号行を作成
     * 信号の種類に応じて適切なUI要素を生成
     * 
     * @param {Object} signal - 信号オブジェクト
     * @param {number} index - 信号のインデックス
     * @returns {HTMLElement} 作成された信号行要素
     */
    function createSignalRow(signal, index) {
        const signalRow = document.createElement('div');
        signalRow.className = 'signal-row';
        
        // アクセシビリティ設定
        signalRow.tabIndex = 0;
        signalRow.setAttribute('role', 'listitem');
        signalRow.setAttribute('aria-label', `信号 ${index + 1}: ${signal.name}`);

        // 信号名入力フィールド
        const nameInput = createNameInput(signal);
        signalRow.appendChild(nameInput);

        // 信号タイプ選択
        const typeSelect = createTypeSelect(signal, index);
        signalRow.appendChild(typeSelect);

        // 信号タイプに応じた追加要素
        if (signal.type === 'bus') {
            const busElements = createBusElements(signal);
            busElements.forEach(element => signalRow.appendChild(element));
        } else if (signal.type === 'clk') {
            const clkElements = createClockElements(signal);
            clkElements.forEach(element => signalRow.appendChild(element));
        }

        // 削除ボタン
        const deleteBtn = createDeleteButton(index);
        signalRow.appendChild(deleteBtn);

        return signalRow;
    }

    /**
     * 信号名入力フィールドを作成
     */
    function createNameInput(signal) {
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.value = signal.name;
        nameInput.setAttribute('aria-label', '信号名');
        
        Object.assign(nameInput.style, {
            width: '80px',
            marginRight: '5px',
            height: '30px',
            boxSizing: 'border-box'
        });
        
        nameInput.addEventListener('change', (e) => { 
            const oldName = signal.name;
            signal.name = e.target.value;
            
            // 名前変更の通知
            if (oldName !== signal.name) {
                showNotification(`信号名を "${oldName}" から "${signal.name}" に変更しました`, 'info');
            }
        });
        
        nameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.target.blur();
            }
        });
        
        return nameInput;
    }

    /**
     * 信号タイプ選択フィールドを作成
     */
    function createTypeSelect(signal, index) {
        const typeSelect = document.createElement('select');
        
        Object.assign(typeSelect.style, {
            marginRight: '5px',
            height: '30px',
            boxSizing: 'border-box'
        });
        
        const signalTypes = [
            { value: 'binary', label: 'Binary' },
            { value: 'bus', label: 'Bus' },
            { value: 'clk', label: 'Clk' }
        ];
        
        signalTypes.forEach(type => {
            const option = document.createElement('option');
            option.value = type.value;
            option.textContent = type.label;
            if (signal.type === type.value) option.selected = true;
            typeSelect.appendChild(option);
        });
        
        typeSelect.addEventListener('change', (e) => {
            const oldType = signal.type;
            signal.type = e.target.value;
            
            // 信号タイプに応じた初期化
            if (signal.type === 'bus' && !signal.data) {
                signal.data = Array(state.timeSteps).fill('');
                signal.width = signal.width > 1 ? signal.width : 8;
            }
            if (signal.type === 'clk' && !signal.freq) {
                signal.freq = 50;
            }
            
            // 信号リストを再描画してからキャンバスを設定
            renderSignalList();
            setupCanvas();
            
            // タイプ変更の通知
            showNotification(`信号 "${signal.name}" のタイプを ${oldType} から ${signal.type} に変更しました`, 'info');
        });
        
        return typeSelect;
    }

    /**
     * バス信号用の要素を作成
     */
    function createBusElements(signal) {
        const widthLabel = document.createElement('label');
        widthLabel.textContent = 'Width:';
        widthLabel.style.marginRight = '5px';
        
        const widthInput = document.createElement('input');
        widthInput.type = 'number';
        widthInput.value = signal.width;
        widthInput.min = 1;
        
        Object.assign(widthInput.style, {
            width: '50px',
            marginRight: '5px',
            height: '30px',
            boxSizing: 'border-box'
        });
        
        widthInput.addEventListener('change', (e) => { 
            const oldWidth = signal.width;
            signal.width = parseInt(e.target.value, 10);
            
            // 幅変更の通知
            showNotification(`信号 "${signal.name}" の幅を ${oldWidth} から ${signal.width} に変更しました`, 'info');
        });
        
        return [widthLabel, widthInput];
    }

    /**
     * クロック信号用の要素を作成
     */
    function createClockElements(signal) {
        const freqInput = document.createElement('input');
        freqInput.type = 'number';
        freqInput.value = signal.freq;
        
        Object.assign(freqInput.style, {
            width: '50px',
            marginRight: '5px',
            height: '30px',
            boxSizing: 'border-box'
        });
        
        freqInput.addEventListener('change', (e) => {
            const oldFreq = signal.freq;
            signal.freq = parseFloat(e.target.value);
            
            // クロック波形を再生成して描画
            generateAllClockWaves();
            redrawAll();
            
            // 周波数変更の通知
            showNotification(`信号 "${signal.name}" の周波数を ${oldFreq}MHz から ${signal.freq}MHz に変更しました`, 'info');
        });
        
        const freqUnit = document.createElement('span');
        freqUnit.textContent = 'MHz';
        freqUnit.style.marginRight = '5px';
        
        return [freqInput, freqUnit];
    }

    /**
     * 削除ボタンを作成
     */
    function createDeleteButton(index) {
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'X';
        deleteBtn.setAttribute('aria-label', '信号を削除');
        
        Object.assign(deleteBtn.style, {
            height: '30px',
            width: '30px',
            boxSizing: 'border-box',
            marginLeft: '5px'
        });
        
        deleteBtn.addEventListener('click', () => {
            const deletedSignalName = signals[index].name;
            signals.splice(index, 1);
            
            // 信号リストを再描画してからキャンバスを設定
            renderSignalList();
            setupCanvas();
            
            // 削除完了の通知
            showNotification(`信号 "${deletedSignalName}" を削除しました`, 'info');
        });
        
        return deleteBtn;
    }

    // ========================================
    // キャンバス設定・描画
    // ========================================

    /**
     * キャンバスを設定・初期化
     * 波形描画エリアと時間軸のサイズを計算して設定
     * ズーム・スクロール状態もリセット
     */
    function setupCanvas() {
        const newTimeSteps = parseInt(elements.timeStepsInput.value, 10);
        const gridStep = calculateGridStep(newTimeSteps);
        const canvasWidth = newTimeSteps * gridStep;
        
        // 波形キャンバスの設定（最小高さを確保）
        const calculatedHeight = signals.length * DRAWING_CONFIG.signalHeight;
        const canvasHeight = Math.max(DRAWING_CONFIG.minCanvasHeight, calculatedHeight);
        
        // 波形キャンバスの設定
        configureCanvas(elements.canvas, canvasWidth, canvasHeight);
        
        // 時間軸キャンバスの設定（波形と同じ幅、固定高さ）
        configureCanvas(elements.timeAxisCanvas, canvasWidth, 50);
        
        // グリッドステップをグローバル変数として保存（描画関数で使用）
        window.currentGridStep = gridStep;
        
        // ズーム・スクロールをリセット
        state.zoomLevel = 1.0;
        state.scrollOffset = 0;
        
        initializeWaves();
        redrawAll();
    }

    /**
     * キャンバスの設定を統一
     * 内部サイズとスタイルサイズを一致させる
     * 
     * @param {HTMLCanvasElement} canvas - 設定するキャンバス
     * @param {number} width - 幅
     * @param {number} height - 高さ
     */
    function configureCanvas(canvas, width, height) {
        canvas.width = width;
        canvas.height = height;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
    }

    /**
     * すべての描画を実行
     * グリッド、波形、時間軸を順番に描画
     */
    function redrawAll() {
        drawGrid();
        drawWaveforms();
        drawTimeAxis();
    }

    /**
     * グリッドを描画
     * 信号境界の水平線と時間グリッドの垂直線を描画
     * ズーム・スクロールに対応
     */
    function drawGrid() {
        const gridStep = window.currentGridStep;
        ctx.clearRect(0, 0, elements.canvas.width, elements.canvas.height);
        
        // ズーム・スクロール対応の座標変換
        ctx.save();
        ctx.translate(-state.scrollOffset, 0);
        ctx.scale(state.zoomLevel, 1);
        
        // グリッドのスタイル設定
        ctx.strokeStyle = '#f0f0f0';
        ctx.lineWidth = 1;
        
        // 水平線（信号境界）を描画
        drawHorizontalGridLines();
        
        // 垂直線（時間グリッド）を描画
        drawVerticalGridLines(gridStep);
        
        ctx.restore();
    }

    /**
     * 水平グリッド線（信号境界）を描画
     */
    function drawHorizontalGridLines() {
        signals.forEach((_, i) => {
            const y = getSignalYPosition(i);
            ctx.beginPath();
            ctx.moveTo(0, y + DRAWING_CONFIG.signalHeight);
            ctx.lineTo(elements.canvas.width / state.zoomLevel, y + DRAWING_CONFIG.signalHeight);
            ctx.stroke();
        });
    }

    /**
     * 垂直グリッド線（時間グリッド）を描画
     */
    function drawVerticalGridLines(gridStep) {
        const maxX = elements.canvas.width / state.zoomLevel;
        for (let x = 0; x < maxX; x += gridStep) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, elements.canvas.height);
            ctx.stroke();
        }
    }

    /**
     * 時間軸を描画
     * 時間ラベルと目盛り、Time Unit情報を表示
     * ズーム・スクロールに対応しつつ、文字サイズは固定
     */
    function drawTimeAxis() {
        const gridStep = window.currentGridStep;
        
        // 時間軸キャンバスをクリア
        timeCtx.clearRect(0, 0, elements.timeAxisCanvas.width, elements.timeAxisCanvas.height);
        
        // 時間軸の基本設定
        setupTimeAxisStyle();
        
        // 時間軸ラベルを描画
        drawTimeAxisLabels(gridStep);
        
        // Time Unit情報を描画
        drawTimeUnitInfo();
    }

    /**
     * 時間軸のスタイルを設定
     */
    function setupTimeAxisStyle() {
        timeCtx.font = '14px sans-serif';
        timeCtx.textAlign = 'center';
        timeCtx.textBaseline = 'top';
        timeCtx.fillStyle = '#000';
    }

    /**
     * 時間軸ラベルを描画
     */
    function drawTimeAxisLabels(gridStep) {
        // ラベル間隔を動的に計算
        const maxLabels = Math.floor(elements.timeAxisCanvas.width / DRAWING_CONFIG.labelSpacing);
        const interval = Math.max(1, Math.ceil(state.timeSteps / maxLabels));
        
        // 表示範囲を計算（スクロールオフセットを考慮）
        const startStep = Math.max(0, Math.floor(state.scrollOffset / gridStep));
        const endStep = Math.min(state.timeSteps, Math.ceil((state.scrollOffset + elements.timeAxisCanvas.width) / gridStep));
        
        // 時間軸ラベルを描画
        for (let i = startStep; i <= endStep; i += interval) {
            const x = i * gridStep - state.scrollOffset;
            const time = i * state.timeScale;
            
            // 画面外のラベルは描画しない（パフォーマンス向上）
            if (x < -50 || x > elements.timeAxisCanvas.width + 50) continue;
            
            // 時間ラベルを描画
            timeCtx.fillText(time.toFixed(1), x, 5);
            
            // 目盛りを描画
            drawTimeAxisTick(x);
        }
    }

    /**
     * 時間軸の目盛りを描画
     */
    function drawTimeAxisTick(x) {
        timeCtx.beginPath();
        timeCtx.moveTo(x, 0);
        timeCtx.lineTo(x, 5);
        timeCtx.stroke();
    }

    /**
     * Time Unit情報を描画
     */
    function drawTimeUnitInfo() {
        timeCtx.textAlign = 'right';
        timeCtx.font = '16px sans-serif';
        
        // 背景を描画（見やすさのため）
        timeCtx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        timeCtx.fillRect(elements.timeAxisCanvas.width - 200, 20, 190, 20);
        
        // Time Unitテキストを描画
        timeCtx.fillStyle = '#333';
        const unitText = `Time Unit: ${state.timeUnit} | Zoom: ${state.zoomLevel.toFixed(1)}x`;
        timeCtx.fillText(unitText, elements.timeAxisCanvas.width - 10, 25);
    }

    /**
     * 波形を描画
     * 各信号の波形を種類に応じて描画
     * ズーム・スクロールに対応し、表示範囲のみ描画
     */
    function drawWaveforms() {
        const gridStep = window.currentGridStep;
        
        // ズーム・スクロール対応の座標変換
        ctx.save();
        ctx.translate(-state.scrollOffset, 0);
        ctx.scale(state.zoomLevel, 1);
        
        // 波形描画の基本設定
        setupWaveformStyle();
        
        // 表示範囲を計算
        const { startStep, endStep } = calculateVisibleRange(gridStep);
        
        // 各信号の波形を描画
        signals.forEach((signal, signalIndex) => {
            const y = getSignalYPosition(signalIndex);
            
            if (signal.type === 'binary' || signal.type === 'clk') {
                drawBinaryWaveform(signal, y, startStep, endStep, gridStep);
            } else if (signal.type === 'bus') {
                drawBusWaveform(signal, y, startStep, endStep, gridStep);
            }
        });
        
        ctx.restore();
    }

    /**
     * 波形描画のスタイルを設定
     */
    function setupWaveformStyle() {
        ctx.lineWidth = 2;
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
    }

    /**
     * 表示範囲を計算
     */
    function calculateVisibleRange(gridStep) {
        const visibleWidth = elements.canvas.width / state.zoomLevel;
        const startStep = Math.max(0, Math.floor(state.scrollOffset / (gridStep * state.zoomLevel)));
        const endStep = Math.min(state.timeSteps, Math.ceil((state.scrollOffset + visibleWidth) / (gridStep * state.zoomLevel)));
        return { startStep, endStep };
    }

    /**
     * バイナリ/クロック波形を描画
     */
    function drawBinaryWaveform(signal, y, startStep, endStep, gridStep) {
        const color = signal.type === 'clk' ? '#22aa22' : '#0000ff';
        ctx.strokeStyle = color;
        ctx.beginPath();
        
        for (let i = startStep; i < endStep; i++) {
            const value = signal.wave[i];
            if (value === null) continue;
            
            const x = i * gridStep;
            const waveY = y + (value === 1 ? DRAWING_CONFIG.signalHeight * 0.25 : DRAWING_CONFIG.signalHeight * 0.75);
            
            // 前の値と異なる場合は垂直線を描画
            if (i > startStep && signal.wave[i - 1] !== null && signal.wave[i - 1] !== value) {
                const prevX = (i - 1) * gridStep;
                const prevY = y + (signal.wave[i - 1] === 1 ? DRAWING_CONFIG.signalHeight * 0.25 : DRAWING_CONFIG.signalHeight * 0.75);
                ctx.moveTo(x, prevY);
                ctx.lineTo(x, waveY);
            }
            
            // 水平線を描画
            ctx.moveTo(x, waveY);
            ctx.lineTo(x + gridStep, waveY);
        }
        
        ctx.stroke();
    }

    /**
     * バス波形を描画
     */
    function drawBusWaveform(signal, y, startStep, endStep, gridStep) {
        ctx.strokeStyle = '#ff0000';
        ctx.fillStyle = '#000';
        ctx.beginPath();
        
        let lastData = null;
        let segmentStart = startStep;
        
        for (let i = startStep; i <= endStep; i++) {
            const currentData = signal.data ? signal.data[i] : undefined;
            
            if (currentData !== lastData || i === endStep) {
                if (lastData) {
                    drawBusSegment(segmentStart, i, y, lastData, gridStep);
                }
                segmentStart = i;
                lastData = currentData;
            }
        }
        
        ctx.stroke();
    }

    /**
     * バスセグメントを描画
     */
    function drawBusSegment(startStep, endStep, y, data, gridStep) {
        const startX = startStep * gridStep;
        const endX = endStep * gridStep;
        const midX = (startX + endX) / 2;
        
        // バスの境界線を描画
        ctx.moveTo(startX, y + DRAWING_CONFIG.signalHeight * 0.25);
        ctx.lineTo(startX, y + DRAWING_CONFIG.signalHeight * 0.75);
        ctx.moveTo(endX, y + DRAWING_CONFIG.signalHeight * 0.25);
        ctx.lineTo(endX, y + DRAWING_CONFIG.signalHeight * 0.75);
        
        // バスの中央線を描画
        ctx.moveTo(startX, y + DRAWING_CONFIG.signalHeight / 2);
        ctx.lineTo(endX, y + DRAWING_CONFIG.signalHeight / 2);
        
        // データ値を描画
        ctx.fillText(data, midX, y + DRAWING_CONFIG.signalHeight / 2);
    }

    // ========================================
    // イベントハンドラー
    // ========================================

    /**
     * イベントリスナーを設定
     * ボタンクリック、キーボードショートカット、マウスイベントを処理
     */
    function setupEventListeners() {
        // 信号追加ボタン
        elements.addSignalBtn.addEventListener('click', addNewSignal);
        
        // キーボードショートカット
        document.addEventListener('keydown', handleKeyboardShortcuts);
        
        // 設定変更イベント
        elements.timeUnitSelect.addEventListener('change', handleTimeUnitChange);
        elements.timeStepsInput.addEventListener('change', handleTimeStepsChange);
        
        // 出力ボタン
        elements.wavedromBtn.addEventListener('click', generateWaveDrom);
        elements.svTestbenchBtn.addEventListener('click', generateSystemVerilog);
        
        // コピーボタン
        elements.copyWavedromBtn.addEventListener('click', () => {
            copyToClipboard(elements.wavedromOutput, elements.copyWavedromBtn);
        });
        elements.copySvBtn.addEventListener('click', () => {
            copyToClipboard(elements.svTestbenchOutput, elements.copySvBtn);
        });
        
        // マウスイベント
        setupMouseEvents();
        
        // ホイールイベント（ズーム機能）
        elements.canvas.addEventListener('wheel', handleWheelEvent);
        
        // テーマ切り替え
        elements.themeSwitcherBtn.addEventListener('click', switchTheme);
    }

    /**
     * キーボードショートカットを処理
     * 生産性向上のための便利なショートカット
     * ブラウザのデフォルトショートカットとの衝突を避けるため、Altキーを使用
     */
    function handleKeyboardShortcuts(e) {
        // Alt+N で信号追加（ブラウザの新規タブと衝突しない）
        if (e.altKey && e.key === 'n') {
            e.preventDefault();
            addNewSignal();
        }
        // Alt+W でWaveDrom生成（ブラウザの保存と衝突しない）
        if (e.altKey && e.key === 'w') {
            e.preventDefault();
            elements.wavedromBtn.click();
        }
        // Alt+S でSVテストベンチ生成（ブラウザの新規タブと衝突しない）
        if (e.altKey && e.key === 's') {
            e.preventDefault();
            elements.svTestbenchBtn.click();
        }
        // Delete キーで選択された信号を削除
        if (e.key === 'Delete' && document.activeElement.classList.contains('signal-row')) {
            deleteSelectedSignal();
        }
        // ズーム・スクロールショートカット
        handleZoomScrollShortcuts(e);
    }

    /**
     * ズーム・スクロールショートカットを処理
     */
    function handleZoomScrollShortcuts(e) {
        switch (e.key) {
            case '0':
                // 0キーでズームリセット
                resetZoomAndScroll();
                break;
            case '+':
            case '=':
                // +キーでズームイン
                zoomIn();
                break;
            case '-':
                // -キーでズームアウト
                zoomOut();
                break;
            case 'ArrowLeft':
                // 左矢印キーで左スクロール
                scrollLeft();
                break;
            case 'ArrowRight':
                // 右矢印キーで右スクロール
                scrollRight();
                break;
        }
    }

    /**
     * 選択された信号を削除
     */
    function deleteSelectedSignal() {
        const signalIndex = Array.from(document.querySelectorAll('.signal-row')).indexOf(document.activeElement);
        if (signalIndex >= 0) {
            const deletedSignalName = signals[signalIndex].name;
            signals.splice(signalIndex, 1);
            
            // 信号リストを再描画してからキャンバスを設定
            renderSignalList();
            setupCanvas();
            
            // 削除完了の通知
            showNotification(`信号 "${deletedSignalName}" を削除しました`, 'info');
        }
    }

    /**
     * ズーム・スクロールをリセット
     */
    function resetZoomAndScroll() {
        state.zoomLevel = 1.0;
        state.scrollOffset = 0;
        redrawAll();
    }

    /**
     * ズームイン
     */
    function zoomIn() {
        state.zoomLevel = Math.min(DRAWING_CONFIG.zoomRange.max, state.zoomLevel * 1.2);
        redrawAll();
    }

    /**
     * ズームアウト
     */
    function zoomOut() {
        state.zoomLevel = Math.max(DRAWING_CONFIG.zoomRange.min, state.zoomLevel * 0.8);
        redrawAll();
    }

    /**
     * 左スクロール
     */
    function scrollLeft() {
        state.scrollOffset = Math.max(0, state.scrollOffset - DRAWING_CONFIG.scrollStep);
        redrawAll();
    }

    /**
     * 右スクロール
     */
    function scrollRight() {
        state.scrollOffset = Math.min(
            elements.canvas.width - elements.canvas.clientWidth, 
            state.scrollOffset + DRAWING_CONFIG.scrollStep
        );
        redrawAll();
    }

    /**
     * 新しい信号を追加
     * デフォルトでバイナリ信号として作成
     */
    function addNewSignal() {
        signals.push({ 
            name: `sig${signals.length}`, 
            type: 'binary', 
            wave: Array(state.timeSteps).fill(null), 
            width: 1 
        });
        
        // 信号リストを再描画してからキャンバスを設定
        renderSignalList();
        setupCanvas();
        
        // 追加完了の通知
        showNotification(`信号 "${signals[signals.length - 1].name}" を追加しました`, 'info');
    }

    /**
     * 時間単位変更を処理
     */
    function handleTimeUnitChange(e) {
        state.timeUnit = e.target.value;
        const unitConfig = TIME_CONFIG.units[state.timeUnit];
        state.timeScale = unitConfig.scale;
        generateAllClockWaves();
        redrawAll();
    }

    /**
     * 時間ステップ変更を処理
     */
    function handleTimeStepsChange() {
        const newValue = parseInt(elements.timeStepsInput.value, 10);
        
        if (isNaN(newValue)) {
            elements.timeStepsInput.value = 50;
            showNotification('Stepsには有効な数値を入力してください。', 'error');
            return;
        }
        
        if (newValue < 10) {
            elements.timeStepsInput.value = 10;
            showNotification('Stepsは10以上にしてください。', 'warning');
        } else if (newValue > 200) {
            elements.timeStepsInput.value = 200;
            showNotification('Stepsは200以下にしてください。', 'warning');
        }
        
        setupCanvas();
    }

    /**
     * マウスイベントを設定
     * 描画、スクロール、ドラッグ機能を処理
     */
    function setupMouseEvents() {
        elements.canvas.addEventListener('mousedown', handleMouseDown);
        elements.canvas.addEventListener('mouseup', handleMouseUp);
        elements.canvas.addEventListener('mouseleave', handleMouseLeave);
        elements.canvas.addEventListener('mousemove', handleMouseMove);
    }

    /**
     * マウスダウンイベントを処理
     */
    function handleMouseDown(e) {
        if (e.button === 0) { // 左クリック（描画開始）
            state.isDrawing = true;
            handleDraw(e, true);
        } else if (e.button === 1) { // 中クリック（スクロール開始）
            e.preventDefault();
            state.isDragging = true;
            state.lastMouseX = e.clientX;
            elements.canvas.style.cursor = 'grabbing';
        }
    }

    /**
     * マウスアップイベントを処理
     */
    function handleMouseUp(e) {
        if (e.button === 0) {
            state.isDrawing = false;
            state.currentBusValue = null;
        } else if (e.button === 1) {
            state.isDragging = false;
            elements.canvas.style.cursor = 'crosshair';
        }
    }

    /**
     * マウスリーブイベントを処理
     */
    function handleMouseLeave() {
        state.isDrawing = false;
        state.isDragging = false;
        state.currentBusValue = null;
        elements.canvas.style.cursor = 'crosshair';
    }

    /**
     * マウス移動イベントを処理
     */
    function handleMouseMove(e) {
        if (state.isDrawing) {
            handleDraw(e, false);
        } else if (state.isDragging) {
            handleDrag(e);
        }
    }

    /**
     * ドラッグ処理
     */
    function handleDrag(e) {
        const deltaX = e.clientX - state.lastMouseX;
        state.scrollOffset += deltaX;
        state.scrollOffset = Math.max(0, Math.min(
            state.scrollOffset, 
            elements.canvas.width - elements.canvas.clientWidth
        ));
        state.lastMouseX = e.clientX;
        redrawAll();
    }

    /**
     * ホイールイベントを処理（ズーム機能）
     */
    function handleWheelEvent(e) {
        e.preventDefault();
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        const oldZoom = state.zoomLevel;
        state.zoomLevel = Math.max(
            DRAWING_CONFIG.zoomRange.min, 
            Math.min(DRAWING_CONFIG.zoomRange.max, state.zoomLevel * zoomFactor)
        );
        
        // ズーム中心をマウス位置に設定
        const rect = elements.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const zoomRatio = state.zoomLevel / oldZoom;
        state.scrollOffset = mouseX - (mouseX - state.scrollOffset) * zoomRatio;
        
        redrawAll();
    }

    // ========================================
    // 描画処理・ユーティリティ
    // ========================================

    /**
     * マウス座標を取得
     * キャンバスの座標系に変換し、ズーム・スクロールを考慮
     * 
     * @param {HTMLCanvasElement} canvas - 対象キャンバス
     * @param {MouseEvent} evt - マウスイベント
     * @returns {Object} 変換された座標 {x, y}
     */
    function getMousePos(canvas, evt) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        const mouseX = (evt.clientX - rect.left) * scaleX;
        const mouseY = (evt.clientY - rect.top) * scaleY;
        
        // ズーム・スクロールを考慮した座標変換
        const adjustedX = (mouseX + state.scrollOffset) / state.zoomLevel;
        const adjustedY = mouseY;
        
        return { x: adjustedX, y: adjustedY };
    }

    /**
     * 描画処理を実行
     * マウス位置から信号と時間スロットを特定し、波形を更新
     * 
     * @param {MouseEvent} e - マウスイベント
     * @param {boolean} isClick - クリックイベントかどうか
     */
    function handleDraw(e, isClick = false) {
        if (!state.isDrawing) return;
        
        const pos = getMousePos(elements.canvas, e);
        const gridStep = window.currentGridStep;
        
        // 境界チェック
        if (!isValidPosition(pos)) return;
        
        const timeSlot = Math.floor(pos.x / gridStep);
        const signalIndex = Math.floor(pos.y / DRAWING_CONFIG.signalHeight);
        
        // 時間スロットと信号インデックスの境界チェック
        if (!isValidSignalIndex(signalIndex, timeSlot)) return;
        
        // デバッグ用：信号インデックスと実際の信号名を確認
        if (signalIndex >= 0 && signalIndex < signals.length) {
            console.log(`描画位置: 信号インデックス=${signalIndex}, 信号名="${signals[signalIndex].name}", Y座標=${pos.y}`);
        }

        const signal = signals[signalIndex];
        if (signal.type === 'clk') return; // クロック信号は編集不可

        // 信号タイプに応じた描画処理
        if (signal.type === 'binary') {
            handleBinaryDraw(signal, pos, timeSlot);
        } else if (signal.type === 'bus') {
            handleBusDraw(signal, timeSlot, isClick);
        }
    }

    /**
     * 座標が有効かチェック
     */
    function isValidPosition(pos) {
        return pos.x >= 0 && pos.x < elements.canvas.width && 
               pos.y >= 0 && pos.y < elements.canvas.height;
    }

    /**
     * 信号インデックスと時間スロットが有効かチェック
     */
    function isValidSignalIndex(signalIndex, timeSlot) {
        return signalIndex >= 0 && signalIndex < signals.length && 
               timeSlot >= 0 && timeSlot < state.timeSteps;
    }

    /**
     * 信号の位置を取得
     * 信号リストのUIと波形描画の位置を同期する
     * 
     * @param {number} signalIndex - 信号のインデックス
     * @returns {number} 信号のY座標
     */
    function getSignalYPosition(signalIndex) {
        return signalIndex * DRAWING_CONFIG.signalHeight;
    }

    /**
     * バイナリ信号の描画処理
     */
    function handleBinaryDraw(signal, pos, timeSlot) {
        const yInSignal = pos.y % DRAWING_CONFIG.signalHeight;
        const value = (yInSignal < DRAWING_CONFIG.signalHeight / 2) ? 1 : 0;
        
        if (signal.wave[timeSlot] !== value) {
            signal.wave[timeSlot] = value;
            redrawAll();
        }
    }

    /**
     * バス信号の描画処理
     */
    function handleBusDraw(signal, timeSlot, isClick) {
        if (isClick) {
            state.currentBusValue = prompt(
                `'${signal.name}' の値を入力してください (e.g., 10, 0xAB, 0b101):`, 
                signal.data[timeSlot] || ''
            );
        }
        
        if (state.currentBusValue !== null && signal.data[timeSlot] !== state.currentBusValue) {
            signal.data[timeSlot] = state.currentBusValue;
            redrawAll();
        }
    }

    /**
     * クリップボードにコピー
     * モダンブラウザとレガシーブラウザの両方に対応
     * 
     * @param {HTMLTextAreaElement} textArea - コピーするテキストエリア
     * @param {HTMLButtonElement} button - コピーボタン
     */
    function copyToClipboard(textArea, button) {
        if (!navigator.clipboard) {
            // フォールバック: 古いブラウザ用
            copyToClipboardLegacy(textArea);
            return;
        }
        
        // モダンブラウザ用
        navigator.clipboard.writeText(textArea.value).then(() => {
            showCopySuccess(button);
        }, (err) => {
            console.error('Could not copy text: ', err);
            showNotification('コピーに失敗しました。', 'error');
        });
    }

    /**
     * レガシーブラウザ用のコピー処理
     */
    function copyToClipboardLegacy(textArea) {
        textArea.select();
        try {
            document.execCommand('copy');
            showNotification('クリップボードにコピーしました！', 'info');
        } catch (err) {
            showNotification('コピーに失敗しました。', 'error');
        }
    }

    /**
     * コピー成功時の処理
     */
    function showCopySuccess(button) {
        const originalText = button.textContent;
        button.textContent = 'Copied!';
        showNotification('クリップボードにコピーしました！', 'info');
        setTimeout(() => {
            button.textContent = originalText;
        }, 2000);
    }

    // ========================================
    // 変換機能
    // ========================================

    /**
     * WaveDrom形式でエクスポート
     * 波形データをWaveDromのJSON形式に変換
     */
    function generateWaveDrom() {
        const wavedromObj = { signal: [] };
        
        signals.forEach(signal => {
            const waveData = convertSignalToWaveDrom(signal);
            wavedromObj.signal.push(waveData);
        });
        
        elements.wavedromOutput.value = JSON.stringify(wavedromObj, null, 2);
    }

    /**
     * 信号をWaveDrom形式に変換
     */
    function convertSignalToWaveDrom(signal) {
        let waveStr = '';
        const dataArr = [];
        
        if (signal.type === 'binary' || signal.type === 'clk') {
            waveStr = signal.wave.map(val => val === null ? '.' : val.toString()).join('');
        } else if (signal.type === 'bus') {
            let lastData = null;
            for (const data of signal.data) {
                if (data) {
                    if (data !== lastData) {
                        waveStr += '2';
                        dataArr.push(data);
                        lastData = data;
                    } else {
                        waveStr += '.';
                    }
                } else {
                    waveStr += 'x';
                    lastData = null;
                }
            }
        }
        
        const sig = { name: signal.name, wave: waveStr };
        if (dataArr.length > 0) {
            sig.data = dataArr;
        }
        
        return sig;
    }

    /**
     * SystemVerilogテストベンチを生成
     * 波形データからSystemVerilogのテストベンチコードを生成
     */
    function generateSystemVerilog() {
        let tb = generateSystemVerilogHeader();
        tb += generateSystemVerilogSignals();
        tb += generateSystemVerilogStimulus();
        tb += generateSystemVerilogClocks();
        tb += `endmodule\n`;
        
        elements.svTestbenchOutput.value = tb;
    }

    /**
     * SystemVerilogヘッダーを生成
     */
    function generateSystemVerilogHeader() {
        return `\`timescale 1${state.timeUnit} / 1ps\n\nmodule tb_top;\n\n`;
    }

    /**
     * SystemVerilog信号宣言を生成
     */
    function generateSystemVerilogSignals() {
        let signalDeclarations = '';
        signals.forEach(s => {
            const type = 'logic';
            const vector = s.width > 1 ? `[${s.width - 1}:0]` : '';
            signalDeclarations += `    ${type} ${vector} ${s.name};\n`;
        });
        return signalDeclarations + '\n';
    }

    /**
     * SystemVerilog刺激プロセスを生成
     */
    function generateSystemVerilogStimulus() {
        let tb = `    initial begin\n`;
        
        // 初期値を設定
        signals.forEach(s => {
            if (s.type === 'clk') return;
            if (s.type === 'binary') {
                const initialValue = s.wave[0] !== null ? s.wave[0] : 0;
                tb += `        ${s.name} = ${initialValue};\n`;
            } else if (s.type === 'bus') {
                const initialValue = s.data[0] || '0';
                tb += `        ${s.name} = ${formatSvValue(initialValue, s.width)};\n`;
            }
        });
        tb += `\n`;

        // イベントを生成
        const events = generateSystemVerilogEvents();
        tb += generateSystemVerilogEventCode(events);
        
        tb += `\n        #${state.timeScale * 2};\n`;
        tb += `        $finish;\n`;
        tb += `    end\n\n`;
        
        return tb;
    }

    /**
     * SystemVerilogイベントを生成
     */
    function generateSystemVerilogEvents() {
        const events = [];
        
        signals.forEach(s => {
            if (s.type === 'clk') return;
            
            let lastValue = (s.type === 'binary') ? 
                (s.wave[0] !== null ? s.wave[0] : 0) : 
                (s.data[0] || '0');
                
            for (let t = 1; t < state.timeSteps; t++) {
                let currentValue = (s.type === 'binary') ? 
                    (s.wave[t] !== null ? s.wave[t] : 0) : 
                    (s.data[t] || '0');
                    
                if (currentValue !== lastValue) {
                    events.push({ 
                        time: t * state.timeScale, 
                        name: s.name, 
                        value: currentValue, 
                        width: s.width, 
                        isBus: s.type === 'bus' 
                    });
                }
                lastValue = currentValue;
            }
        });

        return events.sort((a, b) => a.time - b.time);
    }

    /**
     * SystemVerilogイベントコードを生成
     */
    function generateSystemVerilogEventCode(events) {
        let tb = '';
        let currentTime = 0;
        
        while (events.length > 0) {
            const nextTime = events[0].time;
            const delay = nextTime - currentTime;
            
            if (delay > 0) {
                tb += `        #${delay};  // time = ${nextTime} ${state.timeUnit}\n`;
            }
            
            currentTime = nextTime;
            const sameTimeEvents = events.filter(e => e.time === nextTime);
            events.splice(0, sameTimeEvents.length);
            
            sameTimeEvents.forEach(event => {
                tb += `        ${event.name} = ${formatSvValue(event.value, event.width)};\n`;
            });
            tb += '\n';
        }
        
        return tb;
    }

    /**
     * SystemVerilogクロック生成プロセスを生成
     */
    function generateSystemVerilogClocks() {
        let tb = '';
        
        signals.forEach(s => {
            if (s.type === 'clk' && s.freq) {
                const freqHz = s.freq * 1e6;
                const periodSeconds = 1 / freqHz;
                const unitConfig = TIME_CONFIG.units[state.timeUnit];
                const halfPeriod = (periodSeconds / unitConfig.multiplier) / 2;
                
                tb += `    initial begin\n`;
                tb += `        ${s.name} = 0;\n`;
                tb += `        forever #${halfPeriod.toFixed(4)} ${s.name} = ~${s.name};\n`;
                tb += `    end\n\n`;
            }
        });
        
        return tb;
    }

    /**
     * SystemVerilog値をフォーマット
     * 幅と値に応じて適切な形式に変換
     */
    function formatSvValue(value, width) {
        if (width <= 1) return value;
        
        const valueStr = value.toString().toLowerCase();
        if (valueStr.startsWith('0x')) {
            return `${width}'h${valueStr.substring(2)}`;
        } else if (valueStr.startsWith('0b')) {
            return `${width}'b${valueStr.substring(2)}`;
        } else {
            return `${width}'d${valueStr}`;
        }
    }

    // ========================================
    // テーマ管理
    // ========================================

    /**
     * テーマ設定
     * ダークテーマ、レトロテーマ、デフォルトテーマを切り替え
     */
    const themes = ['', 'theme-dark', 'theme-retro']; // '' is default
    let currentThemeIndex = 0;

    /**
     * テーマを適用
     */
    function applyTheme(themeName) {
        document.body.className = themeName;
        localStorage.setItem('veriwave-theme', themeName);
        redrawAll(); // キャンバスを再描画してテーマカラーを適用
    }

    /**
     * テーマを切り替え
     */
    function switchTheme() {
        currentThemeIndex = (currentThemeIndex + 1) % themes.length;
        applyTheme(themes[currentThemeIndex]);
    }

    /**
     * 保存されたテーマを読み込み
     */
    function loadSavedTheme() {
        const savedTheme = localStorage.getItem('veriwave-theme');
        if (savedTheme) {
            currentThemeIndex = themes.indexOf(savedTheme);
            if (currentThemeIndex === -1) currentThemeIndex = 0; // フォールバック
            applyTheme(savedTheme);
        } else {
            applyTheme(themes[0]); // デフォルトテーマを適用
        }
    }

    // ========================================
    // 初期化
    // ========================================

    /**
     * アプリケーションを初期化
     * すべての設定とイベントリスナーを初期化
     */
    function initializeApplication() {
        // イベントリスナーを設定
        setupEventListeners();
        
        // 保存されたテーマを読み込み
        loadSavedTheme();
        
        // UIを初期化（順序が重要）
        renderSignalList();
        setupCanvas();
        
        // リサイズイベントを設定
        window.addEventListener('resize', setupCanvas);
        
        // 初期化完了の通知
        console.log('🚀 VeriWave が正常に初期化されました！');
        console.log('💡 ヒント: Ctrl+N で信号追加、Ctrl+S でWaveDrom生成、Ctrl+T でSVテストベンチ生成');
        console.log('🔧 デバッグ: 信号の位置ずれが発生した場合は、コンソールログを確認してください');
    }

    // アプリケーションを開始
    initializeApplication();
});
