// Global variables
let visualizationActive = false;
let dataFetchInterval;
let currentPoints = [];
let currentLines = [];
let scene, camera, renderer, controls;
let earth, clouds, pointsGroup;
let redPointCount = 0;
let greenPointCount = 0;

// API endpoints
const API_BASE_URL = window.location.protocol + '//' + window.location.hostname + ':5000';
const API_ALL_DATA = API_BASE_URL + '/api/ipdata';
const API_RECENT_DATA = API_BASE_URL + '/api/recent';

// Control flags
let isRotating = true;
let showGreenPoints = true;
let showRedPoints = true;

// Initialize Three.js
function initThreeJS() {
    // Scene setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    // Camera setup
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 2;

    // Renderer setup
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('canvas-container').appendChild(renderer.domElement);

    // Controls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enabled = true; // Make sure controls are enabled
}

// Convert lat/lon to 3D position
function latLonToVector3(lat, lon, radius) {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    
    const x = -radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.cos(phi);
    const z = radius * Math.sin(phi) * Math.sin(theta);
    
    return new THREE.Vector3(x, y, z);
}

// Create the globe with textures
function createGlobe() {
    // Earth geometry
    const geometry = new THREE.SphereGeometry(1, 64, 64);
    
    // Earth texture
    const textureLoader = new THREE.TextureLoader();
    
    // Set crossOrigin to allow loading from other domains
    textureLoader.crossOrigin = 'anonymous';
    
    const earthTexture = textureLoader.load('https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg');
    const bumpMap = textureLoader.load('https://threejs.org/examples/textures/planets/earth_normal_2048.jpg');
    const specularMap = textureLoader.load('https://threejs.org/examples/textures/planets/earth_specular_2048.jpg');
    
    // Earth material
    const material = new THREE.MeshPhongMaterial({
        map: earthTexture,
        bumpMap: bumpMap,
        bumpScale: 0.05,
        specularMap: specularMap,
        specular: new THREE.Color('grey'),
        shininess: 5
    });
    
    // Earth mesh
    earth = new THREE.Mesh(geometry, material);
    scene.add(earth);
    
    // Create a group for points that will be attached to the earth
    pointsGroup = new THREE.Group();
    earth.add(pointsGroup);
    
    // Add clouds
    const cloudGeometry = new THREE.SphereGeometry(1.01, 64, 64);
    const cloudTexture = textureLoader.load('https://threejs.org/examples/textures/planets/earth_clouds_1024.png');
    const cloudMaterial = new THREE.MeshPhongMaterial({
        map: cloudTexture,
        transparent: true,
        opacity: 0.4
    });
    clouds = new THREE.Mesh(cloudGeometry, cloudMaterial);
    scene.add(clouds);
    
    // Add stars
    const starGeometry = new THREE.BufferGeometry();
    const starMaterial = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.02
    });
    
    const starVertices = [];
    for (let i = 0; i < 10000; i++) {
        const x = (Math.random() - 0.5) * 2000;
        const y = (Math.random() - 0.5) * 2000;
        const z = (Math.random() - 0.5) * 2000;
        starVertices.push(x, y, z);
    }
    
    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);
    
    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0x333333);
    scene.add(ambientLight);
    
    // Add directional light (sun)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 3, 5);
    scene.add(directionalLight);
}

// Fetch data from the API
async function fetchIPData(endpoint = API_RECENT_DATA) {
    try {
        const response = await fetch(endpoint);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Error fetching data:", error);
        return [];
    }
}

// Clear all existing points
function clearAllPoints() {
    // Reset point counters
    redPointCount = 0;
    greenPointCount = 0;
    
    // Remove all existing points from the scene
    while (pointsGroup.children.length > 0) {
        const group = pointsGroup.children[0];
        
        // Remove all meshes from the group
        while (group.children.length > 0) {
            const mesh = group.children[0];
            group.remove(mesh);
            // Dispose of geometry and material
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) mesh.material.dispose();
        }
        
        pointsGroup.remove(group);
    }
    
    // Clear the current points array
    currentPoints = [];
    
    // Update stats display
    updateStatsDisplay();
}

// Create points for IP locations
function createIPPoints(data) {
    // Clear existing points first
    clearAllPoints();
    
    const group = new THREE.Group();
    const radius = 1.02; // Slightly above earth surface
    
    // Reset point counters
    redPointCount = 0;
    greenPointCount = 0;
    
    data.forEach(item => {
        const position = latLonToVector3(item.lat, item.lon, radius);
        
        // Create point geometry
        const geometry = new THREE.SphereGeometry(0.02, 16, 16);
        const material = new THREE.MeshBasicMaterial({
            color: item.suspicious ? 0xff0000 : 0x00ff00,
        });
        
        const point = new THREE.Mesh(geometry, material);
        point.position.copy(position);
        
        // Store original data for hover info
        point.userData = {
            ip: item.ip,
            lat: item.lat,
            lon: item.lon,
            suspicious: item.suspicious,
            timestamp: item.timestamp
        };
        
        // Apply current visibility settings
        if (item.suspicious) {
            point.visible = showRedPoints;
            redPointCount++;
        } else {
            point.visible = showGreenPoints;
            greenPointCount++;
        }
        
        group.add(point);
    });
    
    pointsGroup.add(group); // Add to pointsGroup instead of scene
    
    // Update stats display
    updateStatsDisplay();
    
    return group.children;
}

// Update the statistics display
function updateStatsDisplay() {
    const statsDisplay = document.getElementById('stats-display');
    if (statsDisplay) {
        statsDisplay.innerHTML = `
            <div class="stat-item">
                <span class="green-dot"></span> Normal: ${greenPointCount}
            </div>
            <div class="stat-item">
                <span class="red-dot"></span> Suspicious: ${redPointCount}
            </div>
            <div class="stat-item">
                Total: ${greenPointCount + redPointCount}
            </div>
        `;
    }
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    if (earth && clouds && isRotating) {
        earth.rotation.y += 0.001;
        clouds.rotation.y += 0.0011;
    }
    
    controls.update();
    renderer.render(scene, camera);
}

// Initialize the application
function init() {
    // Create stats display element
    createStatsDisplay();
    
    initThreeJS();
    createGlobe();
    setupControls();
    animate();
    
    // Load initial data
    loadInitialData();
}

// Create the stats display element
function createStatsDisplay() {
    const statsDisplay = document.createElement('div');
    statsDisplay.id = 'stats-display';
    statsDisplay.className = 'stats-display';
    document.body.appendChild(statsDisplay);
    
    // Add CSS for the stats display
    const style = document.createElement('style');
    style.textContent = `
        .stats-display {
            position: absolute;
            top: 20px;
            left: 20px;
            background-color: rgba(0, 0, 0, 0.7);
            color: white;
            padding: 15px;
            border-radius: 5px;
            font-family: Arial, sans-serif;
            z-index: 1000;
            min-width: 150px;
        }
        .stat-item {
            margin: 5px 0;
            display: flex;
            align-items: center;
        }
        .green-dot, .red-dot {
            display: inline-block;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            margin-right: 8px;
        }
        .green-dot {
            background-color: #00ff00;
        }
        .red-dot {
            background-color: #ff0000;
        }
    `;
    document.head.appendChild(style);
    
    // Initialize with empty stats
    updateStatsDisplay();
}

// Load initial data from API
async function loadInitialData() {
    document.querySelector('.loader').style.display = 'block';
    const data = []
    
    if (data.length > 0) {
        const points = createIPPoints(data);
        currentPoints = [...points];
        
        // Setup raycaster for hover info
        setupRaycaster(currentPoints);
        
        
    }
    
    document.querySelector('.loader').style.display = 'none';
}

// Set up UI controls
function setupControls() {
    // Reset button
    const resetBtn = document.getElementById('resetView');
    resetBtn.addEventListener('click', () => {
        // Reset the camera position
        camera.position.set(0, 0, 2);
        camera.lookAt(0, 0, 0);
        controls.update();
        
    });
    
    // Toggle rotation button
    const rotationBtn = document.getElementById('toggleRotation');
    rotationBtn.addEventListener('click', () => {
        isRotating = !isRotating;
        rotationBtn.textContent = isRotating ? "Stop Rotation" : "Start Rotation";
    });
    
    // Toggle green points button
    const greenBtn = document.getElementById('toggleGreen');
    greenBtn.addEventListener('click', () => {
        showGreenPoints = !showGreenPoints;
        greenBtn.textContent = showGreenPoints ? "Hide Green" : "Show Green";
        updatePointsVisibility();
    });
    
    // Toggle red points button
    const redBtn = document.getElementById('toggleRed');
    redBtn.addEventListener('click', () => {
        showRedPoints = !showRedPoints;
        redBtn.textContent = showRedPoints ? "Hide Red" : "Show Red";
        updatePointsVisibility();
    });
    
    // Fetch data button
    const fetchBtn = document.getElementById('fetchData');
    fetchBtn.addEventListener('click', () => {
        if (visualizationActive) {
            stopLiveVisualization();
            fetchBtn.textContent = "Start Live Data";
        } else {
            startLiveVisualization();
            fetchBtn.textContent = "Stop Live Data";
        }
    });
}

// Update points visibility based on current settings
function updatePointsVisibility() {
    currentPoints.forEach(point => {
        if (point.userData.suspicious) {
            point.visible = showRedPoints;
        } else {
            point.visible = showGreenPoints;
        }
    });
}

// Start live visualization with periodic updates
function startLiveVisualization() {
    visualizationActive = true;
    // Fetch new data every 5 seconds
    dataFetchInterval = setInterval(async () => {
        const newData = await fetchIPData(API_RECENT_DATA);
        
        if (newData.length > 0) {
            // Clear old points and create new ones
            const newPoints = createIPPoints(newData);
            currentPoints = [...newPoints];
            
            // Update raycaster for hover info
            setupRaycaster(currentPoints);
            
        }
    }, 5000);
}

// Stop live visualization
function stopLiveVisualization() {
    clearInterval(dataFetchInterval);
    visualizationActive = false;
}

// Setup raycaster for hover information
function setupRaycaster(points) {
    // Remove any existing event listeners (prevent duplicates)
    window.removeEventListener('mousemove', onMouseMove);
    
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const infoBox = document.getElementById('info');
    
    // Define the handler function
    function onMouseMove(event) {
        // Calculate mouse position in normalized device coordinates
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        
        // Update the raycaster
        raycaster.setFromCamera(mouse, camera);
        
        // Get all visible points from pointsGroup
        const allPoints = [];
        pointsGroup.traverse(object => {
            if (object.isMesh && object.visible) {
                allPoints.push(object);
            }
        });
        
        // Calculate objects intersecting the ray
        const intersects = raycaster.intersectObjects(allPoints);
        
        if (intersects.length > 0) {
            const point = intersects[0].object;
            const data = point.userData;
            
            // Format timestamp if available
            let timestamp = data.timestamp;
            if (timestamp) {
                try {
                    const date = new Date(timestamp);
                    timestamp = date.toLocaleString();
                } catch (e) {
                    // Keep original if parsing fails
                }
            }
            
            // Show info box
            infoBox.style.display = 'block';
            infoBox.style.left = `${event.clientX + 15}px`;
            infoBox.style.top = `${event.clientY + 15}px`;
            
            // Update content
            infoBox.innerHTML = `
                <strong>IP:</strong> ${data.ip || 'N/A'}<br>
                <strong>Coordinates:</strong> ${data.lat.toFixed(2)}, ${data.lon.toFixed(2)}<br>
                <strong>Status:</strong> ${data.suspicious ? 'Suspicious' : 'Normal'}<br>
                <strong>Time:</strong> ${timestamp || 'N/A'}
            `;
        } else {
            // Hide info box when not hovering over a point
            infoBox.style.display = 'none';
        }
    }
    
    // Add the event listener
    window.addEventListener('mousemove', onMouseMove);
}

// Handle window resize
function handleResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Event listeners
window.addEventListener('resize', handleResize);
window.addEventListener('load', init);