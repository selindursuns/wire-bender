import React, { useState, useRef } from 'react';

function DrawingArea() {
    const [paths, setPaths] = useState([]);
    const [currentPath, setCurrentPath] = useState("");
    const svgRef = useRef(null);

    const startDrawing = (event) => {
        const svgRect = svgRef.current.getBoundingClientRect();
        const x = event.clientX - svgRect.left;
        const y = event.clientY - svgRect.top;
        setCurrentPath(`M ${x} ${y}`);
    };

    const draw = (event) => {
        if (!currentPath) return;
        const svgRect = svgRef.current.getBoundingClientRect();
        const x = event.clientX - svgRect.left;
        const y = event.clientY - svgRect.top;
        setCurrentPath(currentPath + ` L ${x} ${y}`);
    };




    const endDrawing = () => {
        if (currentPath) {
            const newPaths = [...paths, currentPath];
            setPaths(newPaths);
            setCurrentPath("");
            sendDrawing(newPaths);  // Send the drawing once the user finishes

            // Sending the paths to the backend
            // fetch('http://localhost:9000/receive-svg', {
            //     method: 'POST',
            //     headers: {
            //         'Content-Type': 'application/json',
            //     },
            //     body: JSON.stringify({ paths })
            // })
            // .then(response => response.json())
            // .then(data => console.log(data.message));
        }
    };

    const sendDrawing = (paths) => {
        fetch('http://localhost:9000/process-drawing', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ paths })
        })
        .then(response => response.json())
        .then(data => console.log('Processed Commands:', data.commands))
        .catch(error => console.error('Error sending drawing data:', error));
    };

    return (
        <svg
            ref={svgRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={endDrawing}
            style={{ border: '1px solid black', cursor: 'crosshair' }}
            width="830"
            height="550"
            viewBox="0 0 830 550"
        >
            {paths.map((path, index) => (
                <path key={index} d={path} stroke="black" strokeWidth="2" fill="none" />
            ))}
            {currentPath && <path d={currentPath} stroke="red" strokeWidth="2" fill="none" />}
        </svg>
    );
}

export default DrawingArea;
