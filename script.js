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
    const copyWavedromBtn = document.getElementById('copy-wavedrom-btn');
    const copySvBtn = document.getElementById('copy-sv-btn');
    const themeSwitcherBtn = document.getElementById('theme-switcher');
    const ctx = canvas.getContext('2d');
    const timeCtx = timeAxisCanvas.getContext('2d');

    // Constants & State
    const gridStep = 20;
    const signalHeight = 40;
    let timeUnit = 'ns';
    let timeScale = 10;

    let signals = [
        { name: 'clk', type: 'clk', wave: [], width: 1, freq: 50 },
        { name: 'rst_n', type: 'binary', wave: [], width: 1 }
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
            if (oldWave) s.wave.splice(0, Math.min(oldWave.length, s.wave.length), ...oldWave.slice(0, s.wave.length));
            if (s.data && oldData) s.data.splice(0, Math.min(oldData.length, s.data.length), ...oldData.slice(0, s.data.length));
        });
        generateAllClockWaves();
    }

    // --- UI Rendering ---
    function renderSignalList() {
        signalListEl.innerHTML = '';
        signals.forEach((signal, index) => {
            const li = document.createElement('li');
            li.className = 'signal-item';

            const nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.value = signal.name;
            nameInput.addEventListener('change', (e) => { signal.name = e.target.value; });
            li.appendChild(nameInput);

            const typeSelect = document.createElement('select');
            ['binary', 'bus', 'clk'].forEach(type => {
                const option = document.createElement('option');
                option.value = type;
                option.textContent = type.charAt(0).toUpperCase() + type.slice(1);
                if (signal.type === type) option.selected = true;
                typeSelect.appendChild(option);
            });
            typeSelect.addEventListener('change', (e) => {
                signal.type = e.target.value;
                if (signal.type === 'bus' && !signal.data) {
                    signal.data = Array(timeSteps).fill('');
                    signal.width = signal.width > 1 ? signal.width : 8;
                }
                if (signal.type === 'clk' && !signal.freq) {
                    signal.freq = 50;
                }
                renderSignalList();
                redrawAll();
            });
            li.appendChild(typeSelect);

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
            } else if (signal.type === 'clk') {
                const freqInput = document.createElement('input');
                freqInput.type = 'number';
                freqInput.value = signal.freq;
                freqInput.className = 'clk-freq-input';
                freqInput.addEventListener('change', (e) => {
                    signal.freq = parseFloat(e.target.value);
                    generateAllClockWaves();
                    redrawAll();
                });
                li.appendChild(freqInput);
                const freqUnit = document.createElement('span');
                freqUnit.textContent = 'MHz';
                li.appendChild(freqUnit);
            }

            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'X';
            deleteBtn.addEventListener('click', () => {
                signals.splice(index, 1);
                renderSignalList();
                setupCanvas();
            });
            li.appendChild(deleteBtn);

            signalListEl.appendChild(li);
        });
    }

    // --- Clock Generation ---
    function generateAllClockWaves() {
        signals.forEach(signal => {
            if (signal.type === 'clk' && signal.freq) {
                generateClockWave(signal);
            }
        });
    }

    function generateClockWave(clkSignal) {
        const freqHz = clkSignal.freq * 1e6;
        const periodSeconds = 1 / freqHz;
        let unitMultiplier = 1e-9;
        if (timeUnit === 'us') unitMultiplier = 1e-6;
        if (timeUnit === 'ms') unitMultiplier = 1e-3;
        const periodInTimeUnits = periodSeconds / unitMultiplier;
        const periodInGridSteps = periodInTimeUnits / timeScale;
        const halfPeriodInGridSteps = periodInGridSteps / 2;
        if (halfPeriodInGridSteps <= 0) {
            clkSignal.wave.fill(0);
            return;
        };
        let value = 0;
        let counter = 0;
        for (let i = 0; i < timeSteps; i++) {
            clkSignal.wave[i] = value;
            counter++;
            if (counter >= halfPeriodInGridSteps) {
                value = 1 - value;
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
            if (signal.type === 'binary' || signal.type === 'clk') {
                ctx.strokeStyle = signal.type === 'clk' ? '#22aa22' : '#0000ff';
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
        signals.push({ name: `sig${signals.length}`, type: 'binary', wave: [], width: 1 });
        renderSignalList();
        setupCanvas();
    });

    timeUnitSelect.addEventListener('change', (e) => {
        timeUnit = e.target.value;
        if (timeUnit === 'ns') timeScale = 10;
        else if (timeUnit === 'us') timeScale = 1;
        else if (timeUnit === 'ms') timeScale = 0.1;
        generateAllClockWaves();
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
        if (signal.type === 'clk') return;

        if (signal.type === 'binary') {
            const yInSignal = pos.y % signalHeight;
            const value = (yInSignal < signalHeight / 2) ? 1 : 0;
            if (signal.wave[timeSlot] !== value) {
                signal.wave[timeSlot] = value;
                redrawAll();
            }
        } else if (signal.type === 'bus') {
            if (isClick) {
                currentBusValue = prompt(`'${signal.name}' の値を入力してください (e.g., 10, 0xAB, 0b101):`, signal.data[timeSlot] || '');
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

    copyWavedromBtn.addEventListener('click', () => {
        copyToClipboard(wavedromOutput, copyWavedromBtn);
    });

    copySvBtn.addEventListener('click', () => {
        copyToClipboard(svTestbenchOutput, copySvBtn);
    });

    function copyToClipboard(textArea, button) {
        if (!navigator.clipboard) {
            alert("Clipboard API not supported by your browser.");
            return;
        }
        navigator.clipboard.writeText(textArea.value).then(() => {
            const originalText = button.textContent;
            button.textContent = 'Copied!';
            setTimeout(() => {
                button.textContent = originalText;
            }, 2000);
        }, (err) => {
            console.error('Could not copy text: ', err);
            alert('Failed to copy text.');
        });
    }

    // --- Conversion Logic ---
    wavedromBtn.addEventListener('click', () => {
        const wavedromObj = { signal: [] };
        signals.forEach(signal => {
            let waveStr = '';
            const dataArr = [];
            if (signal.type === 'binary' || signal.type === 'clk') {
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
            const type = 'logic';
            const vector = s.width > 1 ? `[${s.width - 1}:0]` : '';
            tb += `    ${type} ${vector} ${s.name};\n`;
        });
        tb += `\n`;

        // Stimulus process
        tb += `    initial begin\n`;
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

        const events = [];
        signals.forEach(s => {
            if (s.type === 'clk') return;
            let lastValue = (s.type === 'binary') ? (s.wave[0] !== null ? s.wave[0] : 0) : (s.data[0] || '0');
            for (let t = 1; t < timeSteps; t++) {
                let currentValue = (s.type === 'binary') ? (s.wave[t] !== null ? s.wave[t] : 0) : (s.data[t] || '0');
                if (currentValue !== lastValue) {
                    events.push({ time: t * timeScale, name: s.name, value: currentValue, width: s.width, isBus: s.type === 'bus' });
                }
                lastValue = currentValue;
            }
        });

        events.sort((a, b) => a.time - b.time);

        let currentTime = 0;
        while (events.length > 0) {
            const nextTime = events[0].time;
            const delay = nextTime - currentTime;
            if (delay > 0) {
                tb += `        #${delay};  // time = ${nextTime} ${timeUnit}\n`;
            }
            currentTime = nextTime;
            const sameTimeEvents = events.filter(e => e.time === nextTime);
            events.splice(0, sameTimeEvents.length);
            sameTimeEvents.forEach(event => {
                tb += `        ${event.name} = ${formatSvValue(event.value, event.width)};\n`;
            });
            tb += '\n';
        }

        tb += `\n        #${timeScale * 2};\n`;
        tb += `        $finish;\n`;
        tb += `    end\n\n`;

        // Clock generation processes
        signals.forEach(s => {
            if (s.type === 'clk' && s.freq) {
                const freqHz = s.freq * 1e6;
                const periodSeconds = 1 / freqHz;
                let unitMultiplier = 1e-9;
                if (timeUnit === 'us') unitMultiplier = 1e-6;
                if (timeUnit === 'ms') unitMultiplier = 1e-3;
                const halfPeriod = (periodSeconds / unitMultiplier) / 2;
                tb += `    initial begin\n`;
                tb += `        ${s.name} = 0;\n`;
                tb += `        forever #${halfPeriod.toFixed(4)} ${s.name} = ~${s.name};\n`;
                tb += `    end\n\n`;
            }
        });

        tb += `endmodule\n`;
        svTestbenchOutput.value = tb;
    });

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

    // --- Initial Load ---
    window.addEventListener('resize', setupCanvas);
    renderSignalList();
    setupCanvas();

    // Theme switching logic
    const themes = ['', 'theme-dark', 'theme-retro']; // '' is default
    let currentThemeIndex = 0;

    function applyTheme(themeName) {
        document.body.className = themeName;
        localStorage.setItem('veriwave-theme', themeName);
        redrawAll(); // Redraw canvases to apply theme colors
    }

    // Load saved theme
    const savedTheme = localStorage.getItem('veriwave-theme');
    if (savedTheme) {
        currentThemeIndex = themes.indexOf(savedTheme);
        if (currentThemeIndex === -1) currentThemeIndex = 0; // Fallback to default
        applyTheme(savedTheme);
    } else {
        applyTheme(themes[0]); // Apply default
    }

    themeSwitcherBtn.addEventListener('click', () => {
        currentThemeIndex = (currentThemeIndex + 1) % themes.length;
        applyTheme(themes[currentThemeIndex]);
    });
});
