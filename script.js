document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const signalListEl = document.getElementById('signal-list');
    const addSignalBtn = document.getElementById('add-signal-btn');
    const canvas = document.getElementById('timing-chart-canvas');
    const timeAxisCanvas = document.getElementById('time-axis-canvas');
    const timeUnitSelect = document.getElementById('time-unit');
    const timeStepsInput = document.getElementById('time-steps');
    const wavedromBtn = document.getElementById('wavedrom-btn');
    const svTestbenchBtn = document.getElementById('sv-testbench-btn');
    const wavedromOutput = document.getElementById('wavedrom-output');
    const svTestbenchOutput = document.getElementById('sv-testbench-output');
    const ctx = canvas.getContext('2d');
    const timeCtx = timeAxisCanvas.getContext('2d');

    // Constants & State
    const gridStep = 20;
    const signalHeight = 40;
    let timeUnit = 'ns';
    let timeScale = 10; // Time per grid step

    let signals = [
        { name: 'clk', wave: [], type: 'binary', width: 1, freq: 50, auto: true },
        { name: 'rst_n', wave: [], type: 'binary', width: 1 }
    ];

    let timeSteps = parseInt(timeStepsInput.value, 10);
    let currentBusValue = null;
    let isDrawing = false;

    function initializeWaves() {
        timeSteps = parseInt(timeStepsInput.value, 10);
        signals.forEach(s => {
            const oldWave = s.wave;
            const oldData = s.data;
            s.wave = Array(timeSteps).fill(null);
            if (s.type === 'bus') {
                s.data = Array(timeSteps).fill('');
            }
            // Preserve existing data if possible
            if (oldWave) s.wave.splice(0, Math.min(oldWave.length, s.wave.length), ...oldWave.slice(0, s.wave.length));
            if (s.data && oldData) s.data.splice(0, Math.min(oldData.length, s.data.length), ...oldData.slice(0, s.data.length));
        });
        generateClockWave();
    }

    // --- UI Rendering ---
    function renderSignalList() {
        signalListEl.innerHTML = '';
        signals.forEach((signal) => {
            const li = document.createElement('li');
            li.className = 'signal-item';

            const nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.value = signal.name;
            nameInput.addEventListener('change', (e) => { signal.name = e.target.value; });
            li.appendChild(nameInput);

            if (signal.name.toLowerCase().includes('clk')) {
                const autoLabel = document.createElement('label');
                autoLabel.textContent = 'Auto:';
                const autoCheckbox = document.createElement('input');
                autoCheckbox.type = 'checkbox';
                autoCheckbox.checked = signal.auto;

                const freqInput = document.createElement('input');
                freqInput.type = 'number';
                freqInput.value = signal.freq;
                freqInput.className = 'clk-freq-input';
                freqInput.disabled = !signal.auto;

                autoCheckbox.addEventListener('change', (e) => {
                    signal.auto = e.target.checked;
                    freqInput.disabled = !signal.auto;
                    if (signal.auto) {
                        generateClockWave();
                    }
                    redrawAll();
                });

                freqInput.addEventListener('change', (e) => {
                    signal.freq = parseFloat(e.target.value);
                    if (signal.auto) {
                        generateClockWave();
                        redrawAll();
                    }
                });

                li.appendChild(autoLabel);
                li.appendChild(autoCheckbox);
                li.appendChild(freqInput);
                const freqUnit = document.createElement('span');
                freqUnit.textContent = 'MHz';
                li.appendChild(freqUnit);
            } else {
                const busLabel = document.createElement('label');
                busLabel.textContent = 'Bus:';
                const busCheckbox = document.createElement('input');
                busCheckbox.type = 'checkbox';
                busCheckbox.checked = signal.type === 'bus';
                busCheckbox.addEventListener('change', (e) => {
                    signal.type = e.target.checked ? 'bus' : 'binary';
                    if (signal.type === 'bus' && !signal.data) {
                        signal.data = Array(timeSteps).fill('');
                    }
                    renderSignalList();
                    redrawAll();
                });
                li.appendChild(busLabel);
                li.appendChild(busCheckbox);

                if (signal.type === 'bus') {
                    const widthLabel = document.createElement('label');
                    widthLabel.textContent = 'Width:';
                    const widthInput = document.createElement('input');
                    widthInput.type = 'number';
                    widthInput.value = signal.width;
                    widthInput.min = 1;
                    widthInput.addEventListener('change', (e) => { signal.width = parseInt(e.target.value, 10); });
                    li.appendChild(widthLabel);
                    li.appendChild(widthInput);
                }
            }
            signalListEl.appendChild(li);
        });
    }

    // --- Clock Generation ---
    function generateClockWave() {
        const clkSignal = signals.find(s => s.name.toLowerCase().includes('clk'));
        if (!clkSignal || !clkSignal.freq || !clkSignal.auto) return;

        const freqHz = clkSignal.freq * 1e6; // MHz to Hz
        const periodSeconds = 1 / freqHz;

        let unitMultiplier = 1e-9; // default ns
        if (timeUnit === 'us') unitMultiplier = 1e-6;
        if (timeUnit === 'ms') unitMultiplier = 1e-3;

        const periodInTimeUnits = periodSeconds / unitMultiplier;
        const periodInGridSteps = periodInTimeUnits / timeScale;
        const halfPeriodInGridSteps = periodInGridSteps / 2;

        if (halfPeriodInGridSteps <= 0) return;

        let value = 0;
        let counter = 0;
        for (let i = 0; i < timeSteps; i++) {
            clkSignal.wave[i] = value;
            counter++;
            if (counter >= halfPeriodInGridSteps) {
                value = 1 - value; // flip
                counter = 0;
            }
        }
    }

    // --- Canvas Setup & Drawing ---
    function setupCanvas() {
        timeSteps = parseInt(timeStepsInput.value, 10);
        const canvasWidth = timeSteps * gridStep;

        canvas.width = canvasWidth;
        canvas.height = signals.length * signalHeight;
        timeAxisCanvas.width = canvasWidth;
        timeAxisCanvas.height = 30;

        initializeWaves();
        redrawAll();
    }

    function redrawAll() {
        drawGrid();
        drawWaveforms();
        drawTimeAxis();
    }

    function drawGrid() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#f0f0f0';
        signals.forEach((_, i) => {
            const y = i * signalHeight;
            ctx.beginPath();
            ctx.moveTo(0, y + signalHeight);
            ctx.lineTo(canvas.width, y + signalHeight);
            ctx.stroke();
        });
        for (let x = 0; x < canvas.width; x += gridStep) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }
    }

    function drawTimeAxis() {
        timeCtx.clearRect(0, 0, timeAxisCanvas.width, timeAxisCanvas.height);
        timeCtx.font = '12px sans-serif';
        timeCtx.textAlign = 'center';
        timeCtx.textBaseline = 'top';
        timeCtx.fillStyle = '#000';
        for (let x = 0; x < canvas.width; x += gridStep * 5) {
            const time = (x / gridStep) * timeScale;
            timeCtx.fillText(time.toFixed(1), x, 5);
            timeCtx.beginPath();
            timeCtx.moveTo(x, 0);
            timeCtx.lineTo(x, 5);
            timeCtx.stroke();
        }
    }

    function drawWaveforms() {
        ctx.lineWidth = 2;
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        signals.forEach((signal, signalIndex) => {
            const y = signalIndex * signalHeight;
            if (signal.type === 'binary') {
                ctx.strokeStyle = '#0000ff';
                ctx.beginPath();
                for (let i = 0; i < signal.wave.length; i++) {
                    const value = signal.wave[i];
                    if (value === null) continue;
                    const x = i * gridStep;
                    const waveY = y + (value === 1 ? signalHeight * 0.25 : signalHeight * 0.75);
                    if (i > 0 && signal.wave[i - 1] !== null && signal.wave[i - 1] !== value) {
                        const prevX = (i - 1) * gridStep;
                        const prevY = y + (signal.wave[i - 1] === 1 ? signalHeight * 0.25 : signalHeight * 0.75);
                        ctx.moveTo(x, prevY);
                        ctx.lineTo(x, waveY);
                    }
                    ctx.moveTo(x, waveY);
                    ctx.lineTo(x + gridStep, waveY);
                }
                ctx.stroke();
            } else if (signal.type === 'bus') {
                ctx.strokeStyle = '#ff0000';
                ctx.fillStyle = '#000';
                ctx.beginPath();
                let lastData = null;
                let segmentStart = 0;
                for (let i = 0; i <= signal.wave.length; i++) {
                    const currentData = signal.data ? signal.data[i] : undefined;
                    if (currentData !== lastData || i === signal.wave.length) {
                        if (lastData) {
                            const startX = segmentStart * gridStep;
                            const endX = i * gridStep;
                            const midX = (startX + endX) / 2;
                            ctx.moveTo(startX, y + signalHeight * 0.25);
                            ctx.lineTo(startX, y + signalHeight * 0.75);
                            ctx.moveTo(endX, y + signalHeight * 0.25);
                            ctx.lineTo(endX, y + signalHeight * 0.75);
                            ctx.moveTo(startX, y + signalHeight / 2);
                            ctx.lineTo(endX, y + signalHeight / 2);
                            ctx.fillText(lastData, midX, y + signalHeight / 2);
                        }
                        segmentStart = i;
                        lastData = currentData;
                    }
                }
                ctx.stroke();
            }
        });
    }

    // --- Event Listeners ---
    addSignalBtn.addEventListener('click', () => {
        signals.push({ name: `sig${signals.length}`, wave: [], type: 'binary', width: 1 });
        renderSignalList();
        setupCanvas();
    });

    timeUnitSelect.addEventListener('change', (e) => {
        timeUnit = e.target.value;
        if (timeUnit === 'ns') timeScale = 10;
        else if (timeUnit === 'us') timeScale = 1;
        else if (timeUnit === 'ms') timeScale = 0.1;
        generateClockWave();
        redrawAll();
    });

    timeStepsInput.addEventListener('change', () => {
        setupCanvas();
    });

    function getMousePos(canvas, evt) {
        const rect = canvas.getBoundingClientRect();
        return { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
    }

    function handleDraw(e, isClick = false) {
        if (!isDrawing) return;
        const pos = getMousePos(canvas, e);
        const timeSlot = Math.floor(pos.x / gridStep);
        const signalIndex = Math.floor(pos.y / signalHeight);
        if (signalIndex < 0 || signalIndex >= signals.length) return;

        const signal = signals[signalIndex];
        if (signal.name.toLowerCase().includes('clk') && signal.auto) return; // Don't draw on auto-clk

        if (signal.type === 'binary') {
            const yInSignal = pos.y % signalHeight;
            const value = (yInSignal < signalHeight / 2) ? 1 : 0;
            if (signal.wave[timeSlot] !== value) {
                signal.wave[timeSlot] = value;
                redrawAll();
            }
        } else if (signal.type === 'bus') {
            if (isClick) {
                currentBusValue = prompt(`'${signal.name}' の値を入力してください:`, signal.data[timeSlot] || '');
            }
            if (currentBusValue !== null && signal.data[timeSlot] !== currentBusValue) {
                signal.data[timeSlot] = currentBusValue;
                redrawAll();
            }
        }
    }

    canvas.addEventListener('mousedown', (e) => {
        isDrawing = true;
        handleDraw(e, true);
    });
    canvas.addEventListener('mouseup', () => { isDrawing = false; currentBusValue = null; });
    canvas.addEventListener('mouseleave', () => { isDrawing = false; currentBusValue = null; });
    canvas.addEventListener('mousemove', (e) => {
        if (!isDrawing) return;
        handleDraw(e, false);
    });

    // --- Conversion Logic ---
    wavedromBtn.addEventListener('click', () => {
        const wavedromObj = { signal: [] };
        signals.forEach(signal => {
            let waveStr = '';
            const dataArr = [];
            if (signal.type === 'binary') {
                for (const val of signal.wave) {
                    waveStr += val === null ? '.' : val.toString();
                }
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
            wavedromObj.signal.push(sig);
        });
        wavedromOutput.value = JSON.stringify(wavedromObj, null, 2);
    });

    svTestbenchBtn.addEventListener('click', () => {
        let tb = `\`timescale 1${timeUnit} / 1ps\n\n`;
        tb += `module tb_top;\n\n`;

        signals.forEach(s => {
            const type = 'reg'; // All signals are driven by testbench
            const vector = s.width > 1 ? `[${s.width - 1}:0]` : '';
            tb += `    ${type} ${vector} ${s.name};\n`;
        });
        tb += `\n`;

        const clkSignal = signals.find(s => s.name.toLowerCase().includes('clk'));
        if (clkSignal && clkSignal.auto && clkSignal.freq) {
            const freqHz = clkSignal.freq * 1e6;
            const periodSeconds = 1 / freqHz;
            let unitMultiplier = 1e-9;
            if (timeUnit === 'us') unitMultiplier = 1e-6;
            if (timeUnit === 'ms') unitMultiplier = 1e-3;
            const halfPeriod = (periodSeconds / unitMultiplier) / 2;
            tb += `    always #${halfPeriod.toFixed(4)} clk = ~clk;\n\n`;
        }

        tb += `    initial begin\n`;
        let lastValues = {};
        signals.forEach(s => {
            const signalName = s.name;
            if (signalName.toLowerCase().includes('clk')) {
                tb += `        ${signalName} = 0;\n`;
                return;
            }
            if (s.type === 'binary') {
                const initialValue = s.wave[0] !== null ? s.wave[0] : 0;
                tb += `        ${signalName} = ${initialValue};\n`;
                lastValues[signalName] = initialValue;
            } else if (s.type === 'bus') {
                const initialValue = s.data[0] || '0';
                tb += `        ${signalName} = ${initialValue};\n`;
                lastValues[signalName] = initialValue;
            }
        });
        tb += `\n`;

        for (let t = 1; t < timeSteps; t++) {
            let changes = [];
            signals.forEach((s) => {
                const signalName = s.name;
                if (signalName.toLowerCase().includes('clk')) return;

                if (s.type === 'binary') {
                    if (s.wave[t] !== null && s.wave[t] !== lastValues[signalName]) {
                        changes.push(`            ${signalName} = ${s.wave[t]};`);
                        lastValues[signalName] = s.wave[t];
                    }
                } else if (s.type === 'bus') {
                    if (s.data[t] && s.data[t] !== lastValues[signalName]) {
                        changes.push(`            ${signalName} = ${s.data[t]};`);
                        lastValues[signalName] = s.data[t];
                    }
                }
            });

            if (changes.length > 0) {
                tb += `        #${timeScale};\n`;
                tb += changes.join('\n') + '\n';
            }
        }

        tb += `\n        #${timeScale * 2};\n`;
        tb += `        $finish;\n`;
        tb += `    end\n\n`;
        tb += `endmodule\n`;

        svTestbenchOutput.value = tb;
    });

    // --- Initial Load ---
    window.addEventListener('resize', setupCanvas);
    renderSignalList();
    setupCanvas();
});
