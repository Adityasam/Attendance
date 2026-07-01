/**
 * AttendanceModule — face-api.js face recognition for attendance marking.
 * Uses tiny_face_detector + face_landmark_68 + face_recognition_128.
 * All processing is client-side (works offline once models are cached).
 */
const AttendanceModule = (() => {
  const MODEL_URL = '/static/models';
  const MATCH_THRESHOLD = 0.5;
  const SCAN_INTERVAL_MS = 1200;  // ms between recognition attempts
  const COOLDOWN_MS = 4000;       // ms before same face can be matched again
  const MODEL_FILES = [
    'tiny_face_detector_model-weights_manifest.json',
    'tiny_face_detector_model-shard1',
    'face_landmark_68_tiny_model-weights_manifest.json',
    'face_landmark_68_tiny_model-shard1',
    'face_recognition_model-weights_manifest.json',
    'face_recognition_model-shard1',
    'face_recognition_model-shard2'
  ];

  let _modelsLoaded = false;
  let _videoEl = null;
  let _canvasEl = null;
  let _statusEl = null;
  let _stream = null;
  let _running = false;
  let _onMatch = null;
  let _lastMatchTime = {};        // EmployeeCode → timestamp
  let _labeledDescriptors = [];

  async function loadModels() {
    if (_modelsLoaded) return;
    _statusEl && (_statusEl.textContent = 'Loading face models…');

    let cached = [];
    try { cached = await ArchDB.getAllFaceModels(); } catch(_) {}
    const cacheMap = {};
    cached.forEach(m => { cacheMap[m.name] = m; });

    const origFetch = window.fetch;
    window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input.url;
      const filename = url.split('/').pop();

      if (cacheMap[filename]) {
        const m = cacheMap[filename];
        return new Response(m.data, { status: 200, headers: { 'Content-Type': m.type } });
      }

      const res = await origFetch(input, init);
      if (res.ok && MODEL_FILES.includes(filename)) {
        const clone = res.clone();
        clone.arrayBuffer().then(data => {
          const type = filename.endsWith('.json') ? 'application/json' : 'application/octet-stream';
          ArchDB.cacheFaceModel(filename, data, type).catch(() => {});
        });
      }
      return res;
    };

    try {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
      ]);
      _modelsLoaded = true;
    } finally {
      window.fetch = origFetch;
    }
  }

  async function buildDescriptors() {
    const employees = await ArchDB.getEmployeesWithFaceData();
    _labeledDescriptors = employees
      .map(emp => {
        try {
          const arr = JSON.parse(emp.FaceData);
          const descriptor = new Float32Array(arr);
          return new faceapi.LabeledFaceDescriptors(emp.EmployeeCode, [descriptor]);
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    // Store employee lookup for name/picture retrieval
    window._empLookup = {};
    employees.forEach(e => { window._empLookup[e.EmployeeCode] = e; });
  }

  async function startCamera(videoEl, canvasEl, statusEl, onMatch) {
    _videoEl = videoEl;
    _canvasEl = canvasEl;
    _statusEl = statusEl;
    _onMatch = onMatch;

    await loadModels();
    _statusEl && (_statusEl.textContent = 'Starting camera…');

    _stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
    });
    _videoEl.srcObject = _stream;
    await new Promise(r => (_videoEl.onloadedmetadata = r));
    _videoEl.play();

    await buildDescriptors();
    _running = true;

    if (_labeledDescriptors.length === 0) {
      _statusEl && (_statusEl.textContent = 'No face data found. Enroll employees first.');
      return;
    }

    _statusEl && (_statusEl.textContent = 'Ready — point camera at employee');
    _loop();
  }

  async function _loop() {
    if (!_running) return;

    try {
      const detections = await faceapi
        .detectAllFaces(_videoEl, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
        .withFaceLandmarks(true)
        .withFaceDescriptors();

      // Draw overlays
      if (_canvasEl) {
        const dims = faceapi.matchDimensions(_canvasEl, _videoEl, true);
        const resized = faceapi.resizeResults(detections, dims);
        _canvasEl.getContext('2d').clearRect(0, 0, _canvasEl.width, _canvasEl.height);
        faceapi.draw.drawDetections(_canvasEl, resized);
      }

      if (detections.length === 0) {
        _statusEl && (_statusEl.textContent = 'No face detected…');
      } else if (_labeledDescriptors.length > 0) {
        const matcher = new faceapi.FaceMatcher(_labeledDescriptors, MATCH_THRESHOLD);
        for (const det of detections) {
          const match = matcher.findBestMatch(det.descriptor);
          if (match.label !== 'unknown') {
            const now = Date.now();
            if ((_lastMatchTime[match.label] || 0) + COOLDOWN_MS < now) {
              _lastMatchTime[match.label] = now;
              const emp = (window._empLookup || {})[match.label];
              if (emp && _onMatch) {
                _statusEl && (_statusEl.textContent = `✓ ${emp.FullName}`);
                _onMatch(emp);
              }
            }
          } else {
            _statusEl && (_statusEl.textContent = 'Face not recognized');
          }
        }
      }
    } catch (e) {
      console.warn('[FaceRec]', e.message);
    }

    if (_running) setTimeout(_loop, SCAN_INTERVAL_MS);
  }

  function stopCamera() {
    _running = false;
    if (_stream) {
      _stream.getTracks().forEach(t => t.stop());
      _stream = null;
    }
    if (_videoEl) _videoEl.srcObject = null;
    if (_canvasEl) _canvasEl.getContext('2d').clearRect(0, 0, _canvasEl.width, _canvasEl.height);
  }

  /**
   * Get face descriptor from an image/canvas element (for enrollment).
   * Returns Float32Array or null.
   */
  async function getFaceDescriptor(imageEl) {
    await loadModels();
    const detection = await faceapi
      .detectSingleFace(imageEl, new faceapi.TinyFaceDetectorOptions({ inputSize: 320 }))
      .withFaceLandmarks(true)
      .withFaceDescriptor();
    return detection ? detection.descriptor : null;
  }

  return { loadModels, startCamera, stopCamera, getFaceDescriptor };
})();
