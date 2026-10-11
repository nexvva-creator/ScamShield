(() => {
  const canvas = document.querySelector("#ascii-flow-background");
  const context = canvas?.getContext("2d");
  if (!canvas || !context) return;

  const directionGlyphs = ["-", "|", "/", "\\"];
  const cellWidth = 14;
  const cellHeight = 16;
  const ambientStep = 3;
  const trailLength = 4;
  const maxDelta = 0.05;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const canvasContext = context;

  let width = 0;
  let height = 0;
  let columns = 0;
  let rows = 0;
  let pixelRatio = 1;
  let time = 0;
  let lastFrame = 0;
  let frame = 0;
  let disposed = false;
  let pointerActive = false;
  let pointerX = -10000;
  let pointerY = -10000;
  let vortexStrength = 0;
  let particleCount = 0;
  let particlesX = new Float32Array(0);
  let particlesY = new Float32Array(0);
  let velocityX = new Float32Array(0);
  let velocityY = new Float32Array(0);
  let historyX = new Float32Array(0);
  let historyY = new Float32Array(0);
  let historyCount = new Uint8Array(0);
  let historyHead = new Uint8Array(0);
  let ambientX = new Float32Array(0);
  let ambientY = new Float32Array(0);
  let ambientSpeed = new Float32Array(0);
  let ambientSamples = 0;

  function hash2(x, y, seed) {
    const value = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
    return value - Math.floor(value);
  }

  function smooth(value) {
    return value * value * (3 - 2 * value);
  }

  function noise2d(x, y, seed) {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const tx = smooth(x - x0);
    const ty = smooth(y - y0);
    const top = hash2(x0, y0, seed) * (1 - tx) + hash2(x0 + 1, y0, seed) * tx;
    const bottom = hash2(x0, y0 + 1, seed) * (1 - tx) + hash2(x0 + 1, y0 + 1, seed) * tx;
    return top * (1 - ty) + bottom * ty;
  }

  function potential(x, y, t) {
    const first = noise2d(x * 0.05, y * 0.05 + t, 11.3);
    const second = noise2d(x * 0.115 - t * 0.6, y * 0.115, 47.9);
    return first * 0.7 + second * 0.3;
  }

  function curlVelocity(x, y, t, epsilon) {
    const scale = 46 / (2 * epsilon);
    const vx = (potential(x, y + epsilon, t) - potential(x, y - epsilon, t)) * scale;
    const vy = -(potential(x + epsilon, y, t) - potential(x - epsilon, y, t)) * scale;
    return [vx, vy];
  }

  function glyphFor(vx, vy) {
    let angle = Math.atan2(vy, vx) % Math.PI;
    if (angle < 0) angle += Math.PI;
    return directionGlyphs[Math.round(angle / (Math.PI / 4)) % directionGlyphs.length];
  }

  function randomGenerator(seed) {
    let state = seed >>> 0;
    return () => {
      state = (state + 0x6d2b79f5) | 0;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  function seedParticles() {
    const random = randomGenerator(0xf1044);
    particleCount = Math.max(60, Math.min(130, Math.floor(columns * rows * 0.045)));
    particlesX = new Float32Array(particleCount);
    particlesY = new Float32Array(particleCount);
    velocityX = new Float32Array(particleCount);
    velocityY = new Float32Array(particleCount);
    historyX = new Float32Array(particleCount * trailLength);
    historyY = new Float32Array(particleCount * trailLength);
    historyCount = new Uint8Array(particleCount);
    historyHead = new Uint8Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      const x = random() * width;
      const y = random() * height;
      particlesX[i] = x;
      particlesY[i] = y;
      for (let slot = 0; slot < trailLength; slot++) {
        historyX[i * trailLength + slot] = x;
        historyY[i * trailLength + slot] = y;
      }
    }
  }

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    if (width < 2 || height < 2) return;

    pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(width * pixelRatio));
    canvas.height = Math.max(1, Math.round(height * pixelRatio));
    canvasContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    canvasContext.font = `${cellHeight}px ui-monospace, "SFMono-Regular", Consolas, monospace`;
    canvasContext.textAlign = "center";
    canvasContext.textBaseline = "middle";

    columns = Math.max(4, Math.ceil(width / cellWidth));
    rows = Math.max(4, Math.ceil(height / cellHeight));
    ambientSamples = Math.ceil(columns / ambientStep) * Math.ceil(rows / ambientStep);
    ambientX = new Float32Array(ambientSamples);
    ambientY = new Float32Array(ambientSamples);
    ambientSpeed = new Float32Array(ambientSamples);
    seedParticles();
    draw(time, false);
  }

  function drawAmbient(t) {
    let index = 0;
    let maximumSpeed = 1e-6;
    for (let gy = 0; gy < rows; gy += ambientStep) {
      for (let gx = 0; gx < columns; gx += ambientStep) {
        const [vx, vy] = curlVelocity(gx * cellWidth, gy * cellHeight, t, 1.5);
        const speed = Math.hypot(vx, vy);
        ambientX[index] = vx;
        ambientY[index] = vy;
        ambientSpeed[index] = speed;
        maximumSpeed = Math.max(maximumSpeed, speed);
        index++;
      }
    }

    index = 0;
    for (let gy = 0; gy < rows; gy += ambientStep) {
      for (let gx = 0; gx < columns; gx += ambientStep) {
        const normalizedSpeed = ambientSpeed[index] / maximumSpeed;
        if (normalizedSpeed >= 0.4) {
          const shaped = ((normalizedSpeed - 0.4) / 0.6) ** 2.2;
          canvasContext.globalAlpha = shaped * 0.24;
          canvasContext.fillText(
            glyphFor(ambientX[index], ambientY[index]),
            gx * cellWidth + cellWidth / 2,
            gy * cellHeight + cellHeight / 2,
          );
        }
        index++;
      }
    }
  }

  function draw(t, includeParticles) {
    if (!width || !height) return;
    canvasContext.clearRect(0, 0, width, height);
    canvasContext.fillStyle = "rgba(185, 185, 185, 0.75)";
    drawAmbient(t);

    if (includeParticles) {
      canvasContext.fillStyle = "rgba(225, 225, 225, 0.62)";
      for (let i = 0; i < particleCount; i++) {
        const glyph = glyphFor(velocityX[i], velocityY[i]);
        const count = historyCount[i];
        const head = historyHead[i];
        const speedGain = 0.2 + 0.5 * Math.min(
          1,
          Math.hypot(velocityX[i], velocityY[i]) / 27.6,
        );
        for (let step = 0; step < count; step++) {
          const slot = (head - step + trailLength) % trailLength;
          const alpha = (1 - step / trailLength) * speedGain;
          if (alpha <= 0.035) continue;
          canvasContext.globalAlpha = alpha;
          const offset = i * trailLength + slot;
          canvasContext.fillText(glyph, historyX[offset], historyY[offset]);
        }
      }
    }

    canvasContext.globalAlpha = 1;
  }

  function updateParticles(deltaTime) {
    time += deltaTime * 0.06;
    vortexStrength += ((pointerActive ? 1 : 0) - vortexStrength) * 0.06;

    for (let i = 0; i < particleCount; i++) {
      let x = particlesX[i];
      let y = particlesY[i];
      let [vx, vy] = curlVelocity(x, y, time, 21);

      if (vortexStrength > 0.01) {
        const dx = x - pointerX;
        const dy = y - pointerY;
        const distanceSquared = dx * dx + dy * dy;
        if (distanceSquared < 120 * 120) {
          const distance = Math.sqrt(distanceSquared) || 1e-3;
          const falloff = 1 - distance / 120;
          const magnitude = falloff * 2.4 * vortexStrength * 20;
          vx += (-dy / distance) * magnitude;
          vy += (dx / distance) * magnitude;
        }
      }

      x = (x + vx * deltaTime + width) % width;
      y = (y + vy * deltaTime + height) % height;
      particlesX[i] = x;
      particlesY[i] = y;
      velocityX[i] = vx;
      velocityY[i] = vy;

      const head = (historyHead[i] + 1) % trailLength;
      historyHead[i] = head;
      historyX[i * trailLength + head] = x;
      historyY[i * trailLength + head] = y;
      if (historyCount[i] < trailLength) historyCount[i]++;
    }
  }

  function animate(now) {
    if (disposed || document.hidden || reducedMotion.matches) return;
    const deltaTime = lastFrame ? Math.min(maxDelta, (now - lastFrame) / 1000) : 1 / 60;
    lastFrame = now;
    updateParticles(deltaTime);
    draw(time, true);
    frame = window.requestAnimationFrame(animate);
  }

  function start() {
    if (disposed || document.hidden || reducedMotion.matches) return;
    window.cancelAnimationFrame(frame);
    lastFrame = 0;
    frame = window.requestAnimationFrame(animate);
  }

  function onPointerMove(event) {
    pointerX = event.clientX;
    pointerY = event.clientY;
    pointerActive = true;
  }

  function onPointerLeave() {
    pointerActive = false;
  }

  function onVisibilityChange() {
    if (document.hidden) {
      window.cancelAnimationFrame(frame);
      frame = 0;
      return;
    }
    if (reducedMotion.matches) draw(time, false);
    else start();
  }

  function onMotionPreferenceChange() {
    window.cancelAnimationFrame(frame);
    frame = 0;
    lastFrame = 0;
    if (reducedMotion.matches) draw(time, false);
    else start();
  }

  resize();
  window.addEventListener("resize", resize, { passive: true });
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("pointerleave", onPointerLeave, { passive: true });
  document.addEventListener("visibilitychange", onVisibilityChange);
  reducedMotion.addEventListener("change", onMotionPreferenceChange);
  if (reducedMotion.matches) draw(0, false);
  else start();

  window.addEventListener("pagehide", () => {
    disposed = true;
    window.cancelAnimationFrame(frame);
    window.removeEventListener("resize", resize);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerleave", onPointerLeave);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    reducedMotion.removeEventListener("change", onMotionPreferenceChange);
  }, { once: true });
})();
