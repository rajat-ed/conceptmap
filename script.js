const apiKeyInput = document.getElementById('api-key');
const inputText = document.getElementById('input-text');
const generateButton = document.getElementById('generate-button');
const clearButton = document.getElementById('clear-button');
const exportPngButton = document.getElementById('export-png-button');
const conceptMapContainer = document.getElementById('concept-map');
const textDisplay = document.getElementById('text-display');
const errorMessage = document.getElementById('error-message');
const loadingIndicator = document.getElementById('loading-indicator');
let conceptMapData = null;
let nodes = [];
let links = [];

generateButton.addEventListener('click', async () => {
    errorMessage.textContent = '';
    loadingIndicator.style.display = 'block';
    conceptMapContainer.innerHTML = '';
    textDisplay.innerHTML = '<h2>Node Details</h2><p>Hover over a node to see more information.</p>';
    exportPngButton.style.display = 'none';
    nodes = [];
    links = [];

    const apiKey = apiKeyInput.value.trim();
    const text = inputText.value.trim();

    if (!apiKey) {
        errorMessage.textContent = 'Please enter your Gemini API Key.';
        loadingIndicator.style.display = 'none';
        return;
    }
    if (!text) {
        errorMessage.textContent = 'Please enter some text.';
        loadingIndicator.style.display = 'none';
        return;
    }

    try {
        conceptMapData = await generateConceptMapData(text, apiKey);
        if (conceptMapData) {
            renderConceptMap(conceptMapData);
            exportPngButton.style.display = 'inline-block';
        } else {
            errorMessage.textContent = 'Failed to generate concept map data.';
        }
    } catch (error) {
        errorMessage.textContent = `Error: ${error.message || 'Unknown error'}`;
    } finally {
        loadingIndicator.style.display = 'none';
    }
});

clearButton.addEventListener('click', () => {
    inputText.value = '';
    conceptMapContainer.innerHTML = '<div id="footer">Concept map generator by Rajat</div>';
    textDisplay.innerHTML = '<h2>Node Details</h2><p>Hover over a node to see more information.</p>';
    errorMessage.textContent = '';
    loadingIndicator.style.display = 'none';
    exportPngButton.style.display = 'none';
    nodes = [];
    links = [];
    conceptMapData = null;
});

exportPngButton.addEventListener('click', () => {
    const svgElement = conceptMapContainer.querySelector('svg');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const width = conceptMapContainer.offsetWidth;
    const height = conceptMapContainer.offsetHeight;
    canvas.width = width;
    canvas.height = height;

    ctx.fillStyle = '#ecf0f1';
    ctx.fillRect(0, 0, width, height);

    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svgElement);
    const img = new Image();

    img.onload = () => {
        ctx.drawImage(img, 0, 0);

        nodes.forEach(node => {
            const rect = node.element.getBoundingClientRect();
            const containerRect = conceptMapContainer.getBoundingClientRect();
            const x = rect.left - containerRect.left;
            const y = rect.top - containerRect.top;

            ctx.fillStyle = node.color;
            ctx.beginPath();
            ctx.roundRect(x, y, rect.width, rect.height, 15);
            ctx.fill();

            ctx.fillStyle = '#fff';
            ctx.font = node.element.classList.contains('main') ? 'bold 16px Segoe UI' : 'bold 14px Segoe UI';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const textContent = `${node.element.querySelector('.emoji').textContent} ${node.element.querySelector('span:nth-child(2)').textContent}`;
            const lines = wrapText(ctx, textContent, rect.width - 20);
            const lineHeight = node.element.classList.contains('main') ? 20 : 18;
            const totalHeight = lines.length * lineHeight;
            const startY = y + (rect.height - totalHeight) / 2 + lineHeight / 2;

            lines.forEach((line, index) => {
                ctx.fillText(line, x + rect.width / 2, startY + index * lineHeight);
            });
        });

        ctx.fillStyle = '#7f8c8d';
        ctx.font = '12px Segoe UI';
        ctx.textAlign = 'right';
        ctx.fillText('Concept map generator by Rajat', width - 10, height - 10);

        const url = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = url;
        a.download = 'conceptmap.png';
        a.click();
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgString)));
});

function wrapText(ctx, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
        const testLine = currentLine + ' ' + words[i];
        const metrics = ctx.measureText(testLine);
        if (metrics.width <= maxWidth) {
            currentLine = testLine;
        } else {
            lines.push(currentLine);
            currentLine = words[i];
        }
    }
    lines.push(currentLine);
    return lines;
}

async function generateConceptMapData(text, apiKey) {
    const prompt = `Given the following text: "${text}", create an educational concept map. Extract the main topic and key subtopics with their relationships in such a way that it is easy for anyone to visualise and learn. For each topic and subtopic, provide a short description of at least 100 to 150 words in bullet points and suggest an emoji to represent them visually in the strongest way. Return the data in a **strict and valid JSON** format like this:

    \`\`\`json
    {
        "mainTopic": {
            "name": "Main Topic Extracted from Text",
            "description": "A brief explanation of the main topic.",
            "emoji": "🌟"
        },
        "subtopics": [
            {
                "name": "Subtopic 1",
                "parent": "Main Topic Extracted from Text",
                "description": "A brief explanation of Subtopic 1.",
                "emoji": "🧬"
            },
            {
                "name": "Subtopic 2",
                "parent": "Main Topic Extracted from Text",
                "description": "A brief explanation of Subtopic 2.",
                "emoji": "🌍"
            }
        ]
    }
    \`\`\`

    **IMPORTANT:** Ensure the "parent" field reflects the hierarchy. Include meaningful descriptions and relevant emojis. Respond only with JSON.`;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.4, maxOutputTokens: 4096 },
                safetySettings: [
                    { "category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE" },
                    { "category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_MEDIUM_AND_ABOVE" },
                    { "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_MEDIUM_AND_ABOVE" },
                    { "category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE" }
                ]
            })
        });

        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const data = await response.json();
        const geminiResponse = data.candidates[0].content.parts[0].text;

        console.log("Raw Gemini Response:", geminiResponse);

        let jsonString = geminiResponse;
        const jsonStart = jsonString.indexOf('{');
        const jsonEnd = jsonString.lastIndexOf('}');

        if (jsonStart === -1 || jsonEnd === -1 || jsonStart > jsonEnd) {
            throw new Error("No valid JSON structure found in the response.");
        }

        jsonString = jsonString.substring(jsonStart, jsonEnd + 1);

        let parsedData;
        try {
            parsedData = JSON.parse(jsonString);
        } catch (parseError) {
            console.error("Failed to parse JSON:", parseError);
            console.error("Extracted JSON String:", jsonString);
            throw new Error("Invalid JSON format received from Gemini API.");
        }

        if (!parsedData.mainTopic || !Array.isArray(parsedData.subtopics)) {
            throw new Error("JSON is missing required fields (mainTopic or subtopics).");
        }

        return parsedData;
    } catch (error) {
        console.error("Gemini API Error:", error);
        throw new Error(`Failed to generate concept map data: ${error.message}`);
    }
}

function renderConceptMap(data) {
    conceptMapContainer.innerHTML = '<div id="footer">Concept map generator by Rajat</div>';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', conceptMapContainer.offsetWidth);
    svg.setAttribute('height', conceptMapContainer.offsetHeight);
    conceptMapContainer.insertBefore(svg, conceptMapContainer.firstChild);

    const nodeMap = {};
    const levelMap = { [data.mainTopic.name]: 0 };
    const colorPalette = [
        '#2980b9', '#e74c3c', '#f1c40f', '#27ae60', '#8e44ad',
        '#d35400', '#16a085', '#c0392b', '#7f8c8d', '#3498db'
    ];
    let colorIndex = 0;

    const mainNode = createNode(data.mainTopic.name, 'main', 0, data.mainTopic.emoji, colorPalette[colorIndex++ % colorPalette.length], data.mainTopic.description);
    mainNode.x = conceptMapContainer.offsetWidth / 2;
    mainNode.y = conceptMapContainer.offsetHeight / 2;
    mainNode.fixed = true;
    nodes.push(mainNode);
    nodeMap[data.mainTopic.name] = mainNode;
    conceptMapContainer.appendChild(mainNode.element);

    const subtopicsByParent = {};
    data.subtopics.forEach(sub => {
        subtopicsByParent[sub.parent] = subtopicsByParent[sub.parent] || [];
        subtopicsByParent[sub.parent].push(sub);
    });

    Object.keys(subtopicsByParent).forEach(parent => {
        const parentNode = nodeMap[parent];
        const subtopics = subtopicsByParent[parent];
        subtopics.forEach((sub, index) => {
            const parentLevel = levelMap[sub.parent] || 0;
            levelMap[sub.name] = parentLevel + 1;

            const subNode = createNode(sub.name, `level-${parentLevel + 1}`, parentLevel + 1, sub.emoji, colorPalette[colorIndex++ % colorPalette.length], sub.description);
            const angle = (index / subtopics.length) * 2 * Math.PI;
            const radius = 200 + parentLevel * 150;
            subNode.x = parentNode.x + Math.cos(angle) * radius;
            subNode.y = parentNode.y + Math.sin(angle) * radius;
            nodes.push(subNode);
            nodeMap[sub.name] = subNode;
            conceptMapContainer.appendChild(subNode.element);

            links.push({ source: parentNode, target: subNode });
        });
    });

    simulateForceLayout(svg);
    makeNodesDraggable();
}

function createNode(text, className, level, emoji, color, description) {
    const element = document.createElement('div');
    element.classList.add('node', className);
    element.style.backgroundColor = color;

    const emojiSpan = document.createElement('span');
    emojiSpan.classList.add('emoji');
    emojiSpan.textContent = emoji || '📝';
    element.appendChild(emojiSpan);

    const textSpan = document.createElement('span');
    textSpan.textContent = text;
    element.appendChild(textSpan);

    const isMain = className.includes('main');
    const fontSize = isMain ? 16 : 14;
    const lineHeight = isMain ? 20 : 18;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.font = `bold ${fontSize}px Segoe UI`;
    const textWidth = ctx.measureText(`${emoji} ${text}`).width;
    const maxWidth = Math.max(isMain ? 150 : 120, textWidth + 20);
    const lines = wrapText(ctx, `${emoji} ${text}`, maxWidth - 20);
    const height = Math.max(isMain ? 80 : 60, lines.length * lineHeight + 20);

    element.style.width = `${maxWidth}px`;
    element.style.height = `${height}px`;

    element.addEventListener('mouseover', () => {
        textDisplay.innerHTML = `
            <h2>${text} ${emoji || ''}</h2>
            <p>${description || 'No description available.'}</p>
        `;
    });

    element.addEventListener('mouseout', () => {
        textDisplay.innerHTML = '<h2>Node Details</h2><p>Hover over a node to see more information.</p>';
    });

    return { element, x: 0, y: 0, vx: 0, vy: 0, fixed: false, level, color };
}

function simulateForceLayout(svg) {
    const repulsionConstant = 50000;
    const attractionStrength = 0.01;
    const idealLinkLength = 200;
    const friction = 0.9;
    const maxSpeed = 15;
    let iteration = 0;
    const maxIterations = 1000;

    function update() {
        if (iteration >= maxIterations) {
            console.log("Simulation complete");
            return;
        }

        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const n1 = nodes[i];
                const n2 = nodes[j];
                if (n1 === n2) continue;

                const dx = n2.x - n1.x;
                const dy = n2.y - n1.y;
                const distance = Math.sqrt(dx * dx + dy * dy) || 1;
                const force = repulsionConstant / (distance * distance);
                const fx = (dx / distance) * force;
                const fy = (dy / distance) * force;

                if (!n1.fixed) {
                    n1.vx -= fx;
                    n1.vy -= fy;
                }
                if (!n2.fixed) {
                    n2.vx += fx;
                    n2.vy += fy;
                }
            }
        }

        links.forEach(link => {
            const dx = link.target.x - link.source.x;
            const dy = link.target.y - link.source.y;
            const distance = Math.sqrt(dx * dx + dy * dy) || 1;
            const force = (distance - idealLinkLength) * attractionStrength;
            const fx = (dx / distance) * force;
            const fy = (dy / distance) * force;

            if (!link.source.fixed) {
                link.source.vx += fx;
                link.source.vy += fy;
            }
            if (!link.target.fixed) {
                link.target.vx -= fx;
                link.target.vy -= fy;
            }
        });

        let totalVelocity = 0;
        nodes.forEach(node => {
            const rect = node.element.getBoundingClientRect();
            if (!node.fixed) {
                node.vx *= friction;
                node.vy *= friction;
                node.vx = Math.max(-maxSpeed, Math.min(maxSpeed, node.vx));
                node.vy = Math.max(-maxSpeed, Math.min(maxSpeed, node.vy));
                node.x += node.vx;
                node.y += node.vy;

                const containerRect = conceptMapContainer.getBoundingClientRect();
                node.x = Math.max(rect.width / 2, Math.min(containerRect.width - rect.width / 2, node.x));
                node.y = Math.max(rect.height / 2, Math.min(containerRect.height - rect.height / 2, node.y));
                totalVelocity += Math.abs(node.vx) + Math.abs(node.vy);
            }
            node.element.style.left = `${node.x - rect.width / 2}px`;
            node.element.style.top = `${node.y - rect.height / 2}px`;
        });

        svg.innerHTML = '';
        links.forEach(link => {
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', link.source.x);
            line.setAttribute('y1', link.source.y);
            line.setAttribute('x2', link.target.x);
            line.setAttribute('y2', link.target.y);
            line.setAttribute('stroke', link.target.color);
            svg.appendChild(line);
        });

        iteration++;
        if (totalVelocity > 0.1 && iteration < maxIterations) {
            requestAnimationFrame(update);
        } else {
            console.log("Simulation stopped: velocity low or max iterations reached");
        }
    }

    console.log("Starting simulation");
    requestAnimationFrame(update);
}

function makeNodesDraggable() {
    nodes.forEach(node => {
        let isDragging = false;
        let startX, startY;

        node.element.addEventListener('mousedown', (e) => {
            if (!node.fixed) {
                isDragging = true;
                startX = e.clientX - node.x;
                startY = e.clientY - node.y;
                node.vx = 0;
                node.vy = 0;
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                node.x = e.clientX - startX;
                node.y = e.clientY - startY;
                node.element.style.left = `${node.x - node.element.offsetWidth / 2}px`;
                node.element.style.top = `${node.y - node.element.offsetHeight / 2}px`;
            }
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
        });
    });
}