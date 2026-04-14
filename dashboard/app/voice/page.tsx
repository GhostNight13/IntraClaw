'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';

// ─── Types ────────────────────────────────────────────────────────────────────

type JarvisState = 'idle' | 'listening' | 'thinking' | 'speaking';

interface VoiceMessage {
  role: 'user' | 'jarvis';
  text: string;
  timestamp: Date;
}

// ─── Orb Component ────────────────────────────────────────────────────────────

function JarvisOrb({ state, audioLevel }: { state: JarvisState; audioLevel: number }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    particles: THREE.Points;
    animId: number;
  } | null>(null);
  const stateRef = useRef(state);
  const audioRef = useRef(audioLevel);

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { audioRef.current = audioLevel; }, [audioLevel]);

  useEffect(() => {
    if (!mountRef.current) return;
    const el = mountRef.current;
    const W = el.clientWidth || 400;
    const H = el.clientHeight || 400;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    el.appendChild(renderer.domElement);

    // Scene & Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 100);
    camera.position.z = 3;

    // Particles
    const COUNT = 2000;
    const positions = new Float32Array(COUNT * 3);
    const colors    = new Float32Array(COUNT * 3);
    const sizes     = new Float32Array(COUNT);
    const phases    = new Float32Array(COUNT);

    for (let i = 0; i < COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);
      const r     = 0.8 + Math.random() * 0.4;
      positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
      colors[i * 3]     = 0.2 + Math.random() * 0.3;
      colors[i * 3 + 1] = 0.5 + Math.random() * 0.4;
      colors[i * 3 + 2] = 1.0;
      sizes[i]  = 2 + Math.random() * 3;
      phases[i] = Math.random() * Math.PI * 2;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color',    new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('size',     new THREE.BufferAttribute(sizes, 1));

    const mat = new THREE.PointsMaterial({
      size:          0.02,
      vertexColors:  true,
      transparent:   true,
      opacity:       0.85,
      blending:      THREE.AdditiveBlending,
      depthWrite:    false,
      sizeAttenuation: true,
    });

    const particles = new THREE.Points(geo, mat);
    scene.add(particles);

    // Animate
    let t = 0;
    function animate() {
      const id = requestAnimationFrame(animate);
      sceneRef.current && (sceneRef.current.animId = id);
      t += 0.01;

      const s = stateRef.current;
      const al = audioRef.current;
      const pulse = s === 'speaking'  ? 1 + al * 0.5 + Math.sin(t * 8) * 0.05
                  : s === 'listening' ? 1 + Math.sin(t * 6) * 0.08
                  : s === 'thinking'  ? 1 + Math.sin(t * 3) * 0.04
                  : 1 + Math.sin(t) * 0.02;

      const rotSpeed = s === 'speaking'  ? 0.015
                     : s === 'listening' ? 0.01
                     : s === 'thinking'  ? 0.008
                     : 0.003;

      particles.rotation.y += rotSpeed;
      particles.rotation.x += rotSpeed * 0.3;
      particles.scale.setScalar(pulse);

      // Color shift by state
      const posArr  = geo.attributes['position']!.array as Float32Array;
      const colArr  = geo.attributes['color']!.array as Float32Array;
      for (let i = 0; i < COUNT; i++) {
        const wave = Math.sin(t * 2 + phases[i]);
        posArr[i * 3]     += wave * 0.0005;
        posArr[i * 3 + 1] += wave * 0.0005;

        if (s === 'listening') {
          colArr[i * 3]     = 0.1 + Math.sin(t + phases[i]) * 0.1;
          colArr[i * 3 + 1] = 0.7 + Math.sin(t * 2 + phases[i]) * 0.2;
          colArr[i * 3 + 2] = 1.0;
        } else if (s === 'speaking') {
          colArr[i * 3]     = 0.8 + Math.sin(t * 3 + phases[i]) * 0.2;
          colArr[i * 3 + 1] = 0.4 + Math.sin(t * 2 + phases[i]) * 0.2;
          colArr[i * 3 + 2] = 0.1;
        } else if (s === 'thinking') {
          colArr[i * 3]     = 0.5 + Math.sin(t + phases[i]) * 0.3;
          colArr[i * 3 + 1] = 0.2;
          colArr[i * 3 + 2] = 0.9 + Math.sin(t * 3 + phases[i]) * 0.1;
        } else {
          colArr[i * 3]     = 0.2 + Math.sin(t * 0.5 + phases[i]) * 0.1;
          colArr[i * 3 + 1] = 0.5 + Math.sin(t * 0.7 + phases[i]) * 0.2;
          colArr[i * 3 + 2] = 1.0;
        }
      }
      geo.attributes['position']!.needsUpdate = true;
      geo.attributes['color']!.needsUpdate    = true;

      renderer.render(scene, camera);
    }
    animate();

    sceneRef.current = { renderer, scene, camera, particles, animId: 0 };

    const handleResize = () => {
      const w = el.clientWidth || 400;
      const h = el.clientHeight || 400;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (sceneRef.current) cancelAnimationFrame(sceneRef.current.animId);
      renderer.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
      sceneRef.current = null;
    };
  }, []);

  const glowColor = state === 'listening' ? '#00d4ff'
                  : state === 'speaking'  ? '#ff6b00'
                  : state === 'thinking'  ? '#8b5cf6'
                  : '#1e40af';

  return (
    <div
      ref={mountRef}
      style={{
        width: '100%',
        height: '100%',
        borderRadius: '50%',
        boxShadow: `0 0 60px ${glowColor}40, 0 0 120px ${glowColor}20`,
        transition: 'box-shadow 0.5s ease',
      }}
    />
  );
}

// ─── Status Label ─────────────────────────────────────────────────────────────

const STATE_LABEL: Record<JarvisState, string> = {
  idle:      'En attente',
  listening: 'Écoute...',
  thinking:  'Réflexion...',
  speaking:  'Répond...',
};

const STATE_COLOR: Record<JarvisState, string> = {
  idle:      '#64748b',
  listening: '#00d4ff',
  thinking:  '#8b5cf6',
  speaking:  '#ff6b00',
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const WS_URL = BASE.replace('http', 'ws') + '/ws';

export default function VoicePage() {
  const [state, setState]       = useState<JarvisState>('idle');
  const [audioLevel, setAudioLevel] = useState(0);
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [transcript, setTranscript] = useState('');
  const [supported, setSupported]   = useState(true);

  const wsRef       = useRef<WebSocket | null>(null);
  const recognRef   = useRef<{ stop(): void } | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animRef     = useRef<number>(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Connect WebSocket
  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data) as {
          type: string;
          reply?: string;
          audio?: string;
          transcript?: string;
        };

        if (msg.type === 'voice_thinking') {
          setState('thinking');
        }

        if (msg.type === 'voice_reply' && msg.reply) {
          setMessages(prev => [...prev, { role: 'jarvis', text: msg.reply!, timestamp: new Date() }]);
          setState('speaking');
        }

        if (msg.type === 'voice_audio' && msg.audio) {
          playAudioBase64(msg.audio).then(() => setState('idle'));
        }
      } catch { /* ignore */ }
    };

    ws.onerror = () => console.warn('WS error');

    return () => { ws.close(); cancelAnimationFrame(animRef.current); };
  }, []);

  // Play base64 audio
  async function playAudioBase64(b64: string): Promise<void> {
    try {
      const bytes  = atob(b64);
      const buf    = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i);

      const ctx    = new AudioContext();
      const decoded = await ctx.decodeAudioData(buf.buffer);
      const src    = ctx.createBufferSource();
      src.buffer   = decoded;
      src.connect(ctx.destination);

      // Analyser for audio level
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      const dataArr = new Uint8Array(analyser.frequencyBinCount);

      function trackLevel() {
        analyser.getByteFrequencyData(dataArr);
        const avg = dataArr.reduce((a, b) => a + b, 0) / dataArr.length;
        setAudioLevel(avg / 128);
        animRef.current = requestAnimationFrame(trackLevel);
      }
      trackLevel();

      src.start();
      await new Promise<void>(res => { src.onended = () => { cancelAnimationFrame(animRef.current); res(); }; });
      await ctx.close();
    } catch { /* fallback: no audio */ }
  }

  // Toggle mic
  const toggleMic = useCallback(() => {
    if (state === 'listening') {
      recognRef.current?.stop();
      setState('idle');
      return;
    }

    // Check Web Speech API
    type SpeechRecognitionCtor = new () => {
      lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number;
      onstart: (() => void) | null;
      onresult: ((evt: { results: { [i: number]: { [j: number]: { transcript: string } }; length: number } }) => void) | null;
      onend: (() => void) | null;
      onerror: (() => void) | null;
      start(): void; stop(): void;
    };
    const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
    const SpeechRecognitionCls = w.SpeechRecognition ?? w.webkitSpeechRecognition;

    if (!SpeechRecognitionCls) { setSupported(false); return; }

    const recog = new SpeechRecognitionCls();
    recog.lang              = 'fr-FR';
    recog.continuous        = false;
    recog.interimResults    = true;
    recog.maxAlternatives   = 1;
    recognRef.current       = recog;

    recog.onstart = () => { setState('listening'); setTranscript(''); };

    recog.onresult = (evt) => {
      const results = evt.results;
      let t = '';
      for (let i = 0; i < results.length; i++) {
        t += results[i]![0]!.transcript;
      }
      setTranscript(t);
    };

    recog.onend = () => {
      if (state !== 'thinking' && transcript.trim()) {
        sendVoice(transcript.trim());
      } else if (!transcript.trim()) {
        setState('idle');
      }
    };

    recog.onerror = () => setState('idle');

    recog.start();
  }, [state, transcript]);

  function sendVoice(text: string) {
    if (!text.trim()) return;
    setMessages(prev => [...prev, { role: 'user', text, timestamp: new Date() }]);
    setTranscript('');
    setState('thinking');

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'voice', transcript: text }));
    } else {
      // Fallback: REST
      fetch(`${BASE}/api/voice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: text }),
      })
        .then(r => r.json())
        .then((data: { reply?: string; audio?: string }) => {
          if (data.reply) setMessages(prev => [...prev, { role: 'jarvis', text: data.reply!, timestamp: new Date() }]);
          if (data.audio) return playAudioBase64(data.audio);
        })
        .then(() => setState('idle'))
        .catch(() => setState('idle'));
    }
  }

  // Keyboard shortcut: Space = toggle mic
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Space' && e.target === document.body) {
        e.preventDefault();
        toggleMic();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggleMic]);

  return (
    <div
      className="flex flex-col items-center justify-between min-h-screen p-6"
      style={{ background: 'var(--bg-main)', color: 'var(--text-primary)' }}
    >
      {/* Header */}
      <div className="w-full flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-widest" style={{ letterSpacing: '0.3em', color: 'var(--text-primary)' }}>
            INTRACLAW
          </h1>
          <p className="text-xs mt-0.5" style={{ color: STATE_COLOR[state], letterSpacing: '0.15em' }}>
            {STATE_LABEL[state].toUpperCase()}
          </p>
        </div>
        <div className="text-xs text-right" style={{ color: 'var(--text-muted)' }}>
          <div>VOICE MODE</div>
          <div>ESPACE = micro</div>
        </div>
      </div>

      {/* Orb */}
      <div className="flex flex-col items-center gap-6" style={{ flex: 1, justifyContent: 'center' }}>
        <div
          style={{ width: 280, height: 280, cursor: 'pointer' }}
          onClick={toggleMic}
          title={state === 'listening' ? 'Cliquer pour arrêter' : 'Cliquer pour parler'}
        >
          <JarvisOrb state={state} audioLevel={audioLevel} />
        </div>

        {/* Transcript in progress */}
        {transcript && (
          <div
            className="px-4 py-2 rounded-xl text-sm max-w-sm text-center"
            style={{ background: 'var(--bg-card)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
          >
            {transcript}
          </div>
        )}

        {/* Mic button */}
        <button
          onClick={toggleMic}
          className="px-8 py-3 rounded-full text-sm font-medium transition-all"
          style={{
            background: state === 'listening'
              ? 'var(--accent-red)20'
              : 'var(--bg-card)',
            color: state === 'listening' ? 'var(--accent-red)' : 'var(--text-muted)',
            border: `1px solid ${state === 'listening' ? 'var(--accent-red)' : 'var(--border)'}`,
            letterSpacing: '0.1em',
          }}
        >
          {state === 'listening' ? '⏹ STOP' : '🎙 PARLER'}
        </button>

        {!supported && (
          <p className="text-xs" style={{ color: 'var(--accent-red)' }}>
            Web Speech API non supporté — utilise Chrome
          </p>
        )}
      </div>

      {/* Message history */}
      {messages.length > 0 && (
        <div
          className="w-full max-w-lg rounded-xl border overflow-hidden"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', maxHeight: 220, overflowY: 'auto' }}
        >
          <div className="flex flex-col gap-1 p-3">
            {messages.slice(-8).map((m, i) => (
              <div
                key={i}
                className="flex gap-2 text-sm"
                style={{ flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }}
              >
                <span
                  className="px-3 py-1.5 rounded-xl max-w-xs"
                  style={{
                    background: m.role === 'user' ? 'var(--accent-blue)20' : 'var(--bg-hover)',
                    color: m.role === 'user' ? 'var(--accent-blue)' : 'var(--text-primary)',
                    fontSize: '0.8rem',
                  }}
                >
                  {m.text}
                </span>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>
      )}
    </div>
  );
}
