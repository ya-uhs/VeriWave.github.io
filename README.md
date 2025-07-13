# VeriWave

VeriWave is a web-based GUI tool for drawing timing charts and generating SystemVerilog testbenches or Wavedrom JSON data.

## Features

- **Interactive Waveform Drawing**: Draw digital waveforms (high/low) directly on the canvas with your mouse.
- **Bus and Binary Signals**: Supports both single-bit binary signals and multi-bit bus signals.
- **Configurable Signals**:
    - Add or remove signals.
    - Toggle between binary and bus types.
    - Set bit-width for bus signals.
- **Automatic Clock Generation**:
    - Automatically generate a clock signal based on a specified frequency.
    - Enable/disable auto-generation to draw the clock manually.
- **Flexible Time Axis**:
    - Adjust the total number of simulation steps.
    - Select time units (`ns`, `us`, `ms`).
- **Code Generation**:
    - **SystemVerilog Testbench**: Generate a `reg`-based stimulus from the drawn waveforms.
    - **Wavedrom**: Convert the waveforms into Wavedrom JSON format for documentation.

## How to Use

1.  **Open `index.html`**: Open the `index.html` file in a modern web browser.
2.  **Configure Signals**:
    - Use the "Add Signal" button to add new signals.
    - For each signal, you can:
        - Change its name.
        - Check the "Bus" box to treat it as a bus and set its width.
        - For the `clk` signal, check/uncheck "Auto" to toggle automatic generation and set the frequency in MHz.
3.  **Set Global Time**:
    - Use the "Time Unit" dropdown to select the base unit for the time axis.
    - Use the "Steps" input to set the total simulation length.
4.  **Draw Waveforms**:
    - **Binary Signals**: Click and drag on the canvas to draw high or low levels.
    - **Bus Signals**: Click on a time slot to enter a value (e.g., `0xAB`). Drag to extend the same value across multiple steps.
5.  **Generate Outputs**:
    - Click "WaveDrom生成" to get the Wavedrom JSON.
    - Click "SVテストベンチ生成" to get the SystemVerilog testbench code.
    - The generated code will appear in the text boxes at the bottom.
