import { useEffect, useRef, useState, useCallback } from "react";

import bgUrl from "./assets/bg.png";
import playerUrl from "./assets/player.png";
import beanUrl from "./assets/bean.png";

export default function Game({ width = 480, height = 800 }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const [imgs, setImgs] = useState({ bg: null, player: null, bean: null });
  const [ready, setReady] = useState(false);

  const GROUND_MARGIN = 12;                         
  const PLAYER_SIZE = Math.round(width * 0.26);     
  const PLAYER_SPEED = Math.max(7, Math.round(width * 0.018));
  const MARGIN = 20;                                
  const HIT_INSET = Math.round(PLAYER_SIZE * 0.2);  
  const BEAN_SIZE = Math.round(width * 0.12);       

  const stateRef = useRef({
    running: true,
    score: 0,
    misses: 0,
    player: {
      x: (width - PLAYER_SIZE) / 2,
      y: height - PLAYER_SIZE - GROUND_MARGIN,
      w: PLAYER_SIZE,
      h: PLAYER_SIZE,
      speed: PLAYER_SPEED,
      vx: 0,
    },
    beans: [],
    beanTimer: 0,
    beanInterval: 60,
    difficultyTimer: 0,
    leftHeld: false,
    rightHeld: false,
  });

  const loadImage = (src) =>
    new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error(`Failed to load image: ${src}`));
      i.src = src;
    });

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const rand = (min, max) => Math.random() * (max - min) + min;
  const rectsOverlap = (a, b) =>
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  // reset size/position 
  const resetGame = useCallback(() => {
    const s = stateRef.current;
    s.running = true;
    s.score = 0;
    s.misses = 0;

    s.player.w = PLAYER_SIZE;
    s.player.h = PLAYER_SIZE;
    s.player.speed = PLAYER_SPEED;
    s.player.vx = 0;
    s.player.x = (width - PLAYER_SIZE) / 2;
    s.player.y = height - PLAYER_SIZE - GROUND_MARGIN;

    s.beans = [];
    s.beanTimer = 0;
    s.beanInterval = 60;
    s.difficultyTimer = 0;
  }, [width, height, PLAYER_SIZE, PLAYER_SPEED, GROUND_MARGIN]);

  useEffect(() => {
    const onDown = (e) => {
      const s = stateRef.current;
      if (["ArrowLeft", "a", "A"].includes(e.key)) s.leftHeld = true;
      if (["ArrowRight", "d", "D"].includes(e.key)) s.rightHeld = true;
      if (!s.running && e.key === " ") resetGame();
    };
    const onUp = (e) => {
      const s = stateRef.current;
      if (["ArrowLeft", "a", "A"].includes(e.key)) s.leftHeld = false;
      if (["ArrowRight", "d", "D"].includes(e.key)) s.rightHeld = false;
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, [resetGame]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;

    const handleTouch = (clientX) => {
      const rect = c.getBoundingClientRect();
      const x = clientX - rect.left;
      const s = stateRef.current;
      s.leftHeld = x < rect.width / 2;
      s.rightHeld = x >= rect.width / 2;
    };

    const onStart = (e) => handleTouch(e.touches[0].clientX);
    const onMove = (e) => handleTouch(e.touches[0].clientX);
    const onEnd = () => {
      const s = stateRef.current;
      s.leftHeld = s.rightHeld = false;
    };

    c.addEventListener("touchstart", onStart, { passive: true });
    c.addEventListener("touchmove", onMove, { passive: true });
    c.addEventListener("touchend", onEnd, { passive: true });

    return () => {
      c.removeEventListener("touchstart", onStart);
      c.removeEventListener("touchmove", onMove);
      c.removeEventListener("touchend", onEnd);
    };
  }, []);

  // ---- load images ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [bg, player, bean] = await Promise.all([
          loadImage(bgUrl),
          loadImage(playerUrl),
          loadImage(beanUrl),
        ]);
        if (!cancelled) {
          setImgs({ bg, player, bean });
          setReady(true);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) setReady(true); // allow fallback rendering
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // game loop
  useEffect(() => {
    if (!ready || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");

    const update = () => {
      const s = stateRef.current;

      if (s.running) {
        // movement
        s.player.vx = 0;
        if (s.leftHeld) s.player.vx -= s.player.speed;
        if (s.rightHeld) s.player.vx += s.player.speed;
        s.player.x = clamp(
          s.player.x + s.player.vx,
          MARGIN,
          width - s.player.w - MARGIN
        );

        // spawn beans
        s.beanTimer--;
        if (s.beanTimer <= 0) {
          s.beans.push({
            x: rand(MARGIN, width - MARGIN - BEAN_SIZE),
            y: -BEAN_SIZE,
            w: BEAN_SIZE,
            h: BEAN_SIZE,
            vy: rand(3, 5) + s.score * 0.02,
          });
          s.beanTimer = s.beanInterval;
        }

        s.difficultyTimer++;
        if (s.difficultyTimer % 600 === 0 && s.beanInterval > 28) {
          s.beanInterval -= 4;
        }

        for (let i = s.beans.length - 1; i >= 0; i--) {
          const b = s.beans[i];
          b.y += b.vy;

          const catchRect = {
            x: s.player.x + HIT_INSET / 2,
            y: s.player.y + HIT_INSET / 2,
            w: s.player.w - HIT_INSET,
            h: s.player.h - HIT_INSET,
          };

          if (
            rectsOverlap(catchRect, { x: b.x, y: b.y, w: b.w, h: b.h })
          ) {
            s.score++;
            s.beans.splice(i, 1); // catch and miss consts
            continue;
          }

          if (b.y > height + 50) {
            s.misses++;
            s.beans.splice(i, 1);
          }
        }

        // game over check
        if (s.misses >= 3) {
          s.running = false;
        }
      }

      ctx.clearRect(0, 0, width, height);

      // background
      if (imgs.bg) ctx.drawImage(imgs.bg, 0, 0, width, height);
      else {
        ctx.fillStyle = "#2a2a2a";
        ctx.fillRect(0, 0, width, height);
      }

      // soft shadow under the player
      const shadowY = s.player.y + s.player.h - 6;
        const shadowW = s.player.w * 0.7;
        const shadowH = Math.max(6, s.player.h * 0.10);
        ctx.save();
        ctx.filter = "blur(6px)";
        ctx.fillStyle = "rgba(0,0,0,0.28)";
        ctx.beginPath();
        ctx.ellipse(
            s.player.x + s.player.w / 2,
            shadowY,
            shadowW / 2,
            shadowH / 2,
            0,
            0,
            Math.PI * 2
        );
        ctx.fill();
        ctx.restore();

      // player
      if (imgs.player)
        ctx.drawImage(
          imgs.player,
          s.player.x,
          s.player.y,
          s.player.w,
          s.player.h
        );
      else {
        ctx.fillStyle = "#ffe08a";
        ctx.fillRect(s.player.x, s.player.y, s.player.w, s.player.h);
      }

      // beans
      s.beans.forEach((b) => {
        if (imgs.bean) ctx.drawImage(imgs.bean, b.x, b.y, b.w, b.h);
        else {
          ctx.fillStyle = "#8b5e3c";
          ctx.fillRect(b.x, b.y, b.w, b.h);
        }
      });

      // UI
      ctx.fillStyle = "#fff";
      ctx.font = "20px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`Score: ${s.score}`, 16, 28);
      ctx.fillText(`Misses: ${s.misses}/3`, width - 130, 28);

      // game over overlay
      if (!s.running) {
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = "#fff";
        ctx.font = "32px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Game Over", width / 2, height / 2 - 20);
        ctx.font = "18px sans-serif";
        ctx.fillText(
          "Press SPACE or tap to restart",
          width / 2,
          height / 2 + 16
        );
      }
      // ends draw
    };

    const loop = () => {
      const s = stateRef.current;

      // allow click/tap to restart the game 
      if (!s.running && canvasRef.current) {
        canvasRef.current.onclick = () => {
          resetGame();
          canvasRef.current.onclick = null;
        };
      }

      update();
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafRef.current);
      if (canvasRef.current) canvasRef.current.onclick = null;
    };
    }, [
        ready,
        imgs,
        width,
        height,
        resetGame,
        BEAN_SIZE,
        MARGIN,
        HIT_INSET,
    ]);

    useEffect(() => {
        const c = canvasRef.current;
        if (!c) return;
        const dpr = window.devicePixelRatio || 1;
        c.width = width * dpr;
        c.height = height * dpr;
        c.style.width = `${width}px`;
        c.style.height = `${height}px`;
        const ctx = c.getContext("2d");
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }, [width, height]);

        return (
            <canvas ref={canvasRef}
            aria-label="Coffee Catcher Girly"
            roles="img"
            style={{
                borderRadius: 16,
                boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
                background: "#222",
                touchAction: "none",
            }}
            />
        );
    }