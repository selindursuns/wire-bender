const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const app = express();
const port = 9000;

app.use(cors());
app.use(bodyParser.json());

// Setup Serial Communication
const serialPort = new SerialPort({
    // path: '/dev/cu.usbmodem21401', 
    path: '/dev/cu.usbmodem21301',
    baudRate: 9600
});

const parser = serialPort.pipe(new ReadlineParser({ delimiter: '\r\n' }));

serialPort.on('open', function () {
    console.log('Serial port opened successfully.');
});

serialPort.on('error', function (error) {
    console.log('Failed to open serial port:', error);
});

parser.on('data', function(data) {
    console.log('Data received from serial port:', data);
});

// Helper function to add delay
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Function to send data to Arduino
async function sendToArduino(data) {
    if (serialPort.isOpen) {
        await serialPort.write(data + '\n', async (err) => {
            if (err) {
                console.log('Failed to write data to serial port:', err.message);
            } else {
                console.log('Sent to Arduino:', data);
                await delay(100); // Ensure command processing time
            }
        });
    } else {
        console.log('Serial port is not open.');
    }
}

function processSVGPath(path) {
    const pixelToMillimeter = 0.1; // 1 pixel = 0.1 mm
    const commands = path.match(/[ML][^ML]+/g).map(segment => {
        const [cmd, ...coords] = segment.trim().split(/\s|,/);
        const points = [];
        for (let i = 0; i < coords.length; i += 2) {
            points.push({
                x: Math.round(parseFloat(coords[i]) * pixelToMillimeter),
                y: Math.round(parseFloat(coords[i + 1]) * pixelToMillimeter)
            });
        }
        return { type: cmd, points };
    });

    const results = [];
    let lastPoint = null;
    commands.forEach(cmd => {
        cmd.points.forEach(point => {
            if (lastPoint) {
                const dx = point.x - lastPoint.x;
                const dy = point.y - lastPoint.y;
                const length = Math.round(Math.sqrt(dx * dx + dy * dy));
                let angle = Math.atan2(dy, dx) * (180 / Math.PI);
                angle = normalizeAngle(angle);
                if (length > 0) {
                    results.push({ length, angle });
                }
            }
            lastPoint = point;
        });
    });
    return results;
}

function normalizeAngle(angle) {
    angle = angle % 360;
    if (angle < 0) {
        angle += 360;
    }
    return angle;
}

function consolidateCommands(commands, angleTolerance = 10, minLength = 0.5) {
    const consolidated = [];
    let last = commands[0];

    last.angle = Math.round(last.angle); // Round the angle of the first command

    for (let i = 1; i < commands.length; i++) {
        commands[i].angle = Math.round(commands[i].angle); // Round the angle of each command
        const angleDiff = Math.abs(last.angle - commands[i].angle);
        
        if (angleDiff <= angleTolerance || (180 - angleDiff) <= angleTolerance) {
            if (last.length + commands[i].length >= minLength) {
                // Combine lengths if the total is above the minimum length
                last.length += commands[i].length;
            }
        } else {
            consolidated.push(last);
            last = commands[i];
            // first = commands[i];
        }
    }
    consolidated.push(last); // Don't forget to add the last processed command

    return consolidated.filter(cmd => cmd.length >= minLength); // Optionally remove very small lengths
}

// Endpoint to process drawing and send commands to Arduino
app.post('/process-drawing', async (req, res) => {
    if (!req.body.paths || !Array.isArray(req.body.paths)) {
        return res.status(400).send('Invalid input: paths must be an array');
    }
    try {
        let commands = [];
        for (const path of req.body.paths) {
            const processedCommands = processSVGPath(path);
            commands = commands.concat(processedCommands);
        }
        let consolidatedCommands = consolidateCommands(commands);
        const commandString = consolidatedCommands.map(cmd => `L${cmd.length}A${cmd.angle}`).join(' ');
        console.log('Command string to send:', commandString); // Debug output

        await sendToArduino(commandString);
        res.json({ commands: consolidatedCommands });
    } catch (error) {
        console.error('Error processing drawing:', error);
        res.status(500).send('An error occurred while processing the drawing.');
    }
});


app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
