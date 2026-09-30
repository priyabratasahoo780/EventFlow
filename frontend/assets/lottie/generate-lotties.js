const fs = require('fs');
const path = require('path');

const LOTTIE_DIR = path.join(__dirname);
if (!fs.existsSync(LOTTIE_DIR)) {
  fs.mkdirSync(LOTTIE_DIR, { recursive: true });
}

// Colors in Lottie RGB [0..1]
const COLORS = {
  orange: [1, 0.478, 0, 1],         // #FF7A00
  orangeDeep: [1, 0.361, 0, 1],     // #FF5C00
  orangeGlow: [1, 0.584, 0, 1],     // #FF9500
  amber: [1, 0.75, 0.05, 1],        // #FFBF0D
  indigo: [0.294, 0.247, 0.863, 1], // #4B3FDC
  indigoBright: [0.42, 0.373, 0.949, 1], // #6B5FF2
  cyan: [0.15, 0.85, 1, 1],         // #26D9FF
  white: [1, 1, 1, 1],
  translucentWhite: [1, 1, 1, 0.4],
};

function hexToRgba(hex, alpha = 1) {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16) / 255;
  const g = parseInt(c.substring(2, 4), 16) / 255;
  const b = parseInt(c.substring(4, 6), 16) / 255;
  return [r, g, b, alpha];
}

// Helper to create static property
const statVal = (val) => ({ a: 0, k: val });

// Helper for smooth linear rotation keyframes [0 -> angle] over frames [0 -> totalFrames]
function rotateKeyframes(startAngle, endAngle, totalFrames = 180) {
  return {
    a: 1,
    k: [
      {
        t: 0,
        s: [startAngle],
        i: { x: [0.833], y: [0.833] },
        o: { x: [0.167], y: [0.167] }
      },
      {
        t: totalFrames,
        s: [endAngle]
      }
    ]
  };
}

// Helper for looping pulse / bounce keyframes
function pulseKeyframes(minVal, maxVal, totalFrames = 180) {
  const mid = totalFrames / 2;
  return {
    a: 1,
    k: [
      {
        t: 0,
        s: [minVal],
        i: { x: [0.45], y: [1] },
        o: { x: [0.55], y: [0] }
      },
      {
        t: mid,
        s: [maxVal],
        i: { x: [0.45], y: [1] },
        o: { x: [0.55], y: [0] }
      },
      {
        t: totalFrames,
        s: [minVal]
      }
    ]
  };
}

// Helper for multi-point scale keyframes
function scalePulse(minScale, maxScale, totalFrames = 180) {
  const mid = totalFrames / 2;
  return {
    a: 1,
    k: [
      {
        t: 0,
        s: [minScale, minScale, 100],
        i: { x: [0.45, 0.45, 0.45], y: [1, 1, 1] },
        o: { x: [0.55, 0.55, 0.55], y: [0, 0, 0] }
      },
      {
        t: mid,
        s: [maxScale, maxScale, 100],
        i: { x: [0.45, 0.45, 0.45], y: [1, 1, 1] },
        o: { x: [0.55, 0.55, 0.55], y: [0, 0, 0] }
      },
      {
        t: totalFrames,
        s: [minScale, minScale, 100]
      }
    ]
  };
}

// ============================================================================
// 1. EVENTFLOW PORTAL ANIMATION (Surrounds and elevates the logo)
// ============================================================================
function generatePortalAnimation() {
  const W = 600;
  const H = 600;
  const FRAMES = 180;
  const layers = [];
  let layerIndex = 1;

  // Layer: Central Ambient Core Glow Pulse
  layers.push({
    ddd: 0,
    ind: layerIndex++,
    ty: 4,
    nm: "Central Glow Aura",
    sr: 1,
    ks: {
      o: pulseKeyframes(25, 60, FRAMES),
      r: statVal(0),
      p: statVal([W / 2, H / 2, 0]),
      a: statVal([0, 0, 0]),
      s: scalePulse(90, 115, FRAMES)
    },
    ao: 0,
    shapes: [
      {
        ty: "gr",
        nm: "Glow Circle",
        it: [
          {
            ty: "el",
            nm: "Ellipse",
            p: statVal([0, 0]),
            s: statVal([240, 240])
          },
          {
            ty: "fl",
            nm: "Fill",
            c: statVal(COLORS.orangeDeep),
            o: statVal(45)
          },
          {
            ty: "tr",
            p: statVal([0, 0]),
            a: statVal([0, 0]),
            s: statVal([100, 100]),
            r: statVal(0),
            o: statVal(100)
          }
        ]
      }
    ],
    ip: 0,
    op: FRAMES,
    st: 0,
    bm: 0
  });

  // Layer: Expanding Energy Shockwave 1
  for (let wave = 0; wave < 3; wave++) {
    const waveOffset = wave * 60;
    layers.push({
      ddd: 0,
      ind: layerIndex++,
      ty: 4,
      nm: `Shockwave Ripple ${wave + 1}`,
      sr: 1,
      ks: {
        o: {
          a: 1,
          k: [
            {
              t: 0,
              s: [wave === 0 ? 70 : 0],
              i: { x: [0.4], y: [1] },
              o: { x: [0.6], y: [0] }
            },
            {
              t: (waveOffset) % FRAMES,
              s: [75],
              i: { x: [0.2], y: [1] },
              o: { x: [0.8], y: [0] }
            },
            {
              t: ((waveOffset + 80) % FRAMES) || FRAMES,
              s: [0]
            }
          ]
        },
        r: rotateKeyframes(wave * 45, wave * 45 + 180, FRAMES),
        p: statVal([W / 2, H / 2, 0]),
        a: statVal([0, 0, 0]),
        s: {
          a: 1,
          k: [
            {
              t: (waveOffset) % FRAMES,
              s: [40, 40, 100],
              i: { x: [0.2], y: [1] },
              o: { x: [0.8], y: [0] }
            },
            {
              t: ((waveOffset + 90) % FRAMES) || FRAMES,
              s: [150, 150, 100]
            }
          ]
        }
      },
      ao: 0,
      shapes: [
        {
          ty: "gr",
          nm: "Ripple Group",
          it: [
            {
              ty: "el",
              nm: "Ellipse",
              p: statVal([0, 0]),
              s: statVal([280, 280])
            },
            {
              ty: "st",
              nm: "Stroke",
              c: statVal(wave % 2 === 0 ? COLORS.orange : COLORS.indigoBright),
              w: statVal(2.5),
              o: statVal(70),
              lc: 2,
              lj: 2
            },
            {
              ty: "tr",
              p: statVal([0, 0]),
              a: statVal([0, 0]),
              s: statVal([100, 100]),
              r: statVal(0),
              o: statVal(100)
            }
          ]
        }
      ],
      ip: 0,
      op: FRAMES,
      st: 0,
      bm: 0
    });
  }

  // Layer: Orbiting Energy Nodes on Outer Ring
  const numNodes = 8;
  const outerRadius = 210;
  for (let i = 0; i < numNodes; i++) {
    const angle = (i * 2 * Math.PI) / numNodes;
    const nx = Math.cos(angle) * outerRadius;
    const ny = Math.sin(angle) * outerRadius;
    const isMajor = i % 2 === 0;

    layers.push({
      ddd: 0,
      ind: layerIndex++,
      ty: 4,
      nm: `Orbital Node ${i + 1}`,
      sr: 1,
      ks: {
        o: pulseKeyframes(isMajor ? 60 : 30, isMajor ? 100 : 70, FRAMES),
        r: statVal(0),
        p: statVal([W / 2 + nx, H / 2 + ny, 0]),
        a: statVal([0, 0, 0]),
        s: scalePulse(isMajor ? 80 : 60, isMajor ? 140 : 110, FRAMES)
      },
      ao: 0,
      shapes: [
        {
          ty: "gr",
          nm: "Node Star",
          it: [
            {
              ty: "el",
              nm: "Orb",
              p: statVal([0, 0]),
              s: statVal([isMajor ? 12 : 7, isMajor ? 12 : 7])
            },
            {
              ty: "fl",
              nm: "Fill",
              c: statVal(isMajor ? COLORS.orange : COLORS.cyan),
              o: statVal(90)
            },
            {
              ty: "tr",
              p: statVal([0, 0]),
              a: statVal([0, 0]),
              s: statVal([100, 100]),
              r: statVal(0),
              o: statVal(100)
            }
          ]
        }
      ],
      ip: 0,
      op: FRAMES,
      st: 0,
      bm: 0
    });
  }

  // Layer: Outer Futuristic Gyro Ring (Clockwise)
  layers.push({
    ddd: 0,
    ind: layerIndex++,
    ty: 4,
    nm: "Outer Gyro Ring",
    sr: 1,
    ks: {
      o: pulseKeyframes(70, 95, FRAMES),
      r: rotateKeyframes(0, 360, FRAMES),
      p: statVal([W / 2, H / 2, 0]),
      a: statVal([0, 0, 0]),
      s: statVal([100, 100, 100])
    },
    ao: 0,
    shapes: [
      {
        ty: "gr",
        nm: "Outer Ring",
        it: [
          {
            ty: "el",
            nm: "Circle",
            p: statVal([0, 0]),
            s: statVal([420, 420])
          },
          {
            ty: "st",
            nm: "Stroke",
            c: statVal(COLORS.orange),
            w: statVal(2),
            o: statVal(60),
            lc: 2,
            lj: 2
          },
          {
            ty: "tr",
            p: statVal([0, 0]),
            a: statVal([0, 0]),
            s: statVal([100, 100]),
            r: statVal(0),
            o: statVal(100)
          }
        ]
      }
    ],
    ip: 0,
    op: FRAMES,
    st: 0,
    bm: 0
  });

  // Layer: Middle Cyber Ring (Counter-Clockwise, Dashed Telemetry)
  layers.push({
    ddd: 0,
    ind: layerIndex++,
    ty: 4,
    nm: "Middle Cyber Ring",
    sr: 1,
    ks: {
      o: pulseKeyframes(60, 90, FRAMES),
      r: rotateKeyframes(360, 0, FRAMES),
      p: statVal([W / 2, H / 2, 0]),
      a: statVal([0, 0, 0]),
      s: statVal([100, 100, 100])
    },
    ao: 0,
    shapes: [
      {
        ty: "gr",
        nm: "Middle Ring",
        it: [
          {
            ty: "el",
            nm: "Circle",
            p: statVal([0, 0]),
            s: statVal([340, 340])
          },
          {
            ty: "st",
            nm: "Stroke",
            c: statVal(COLORS.indigoBright),
            w: statVal(3),
            o: statVal(75),
            lc: 2,
            lj: 2
          },
          {
            ty: "tr",
            p: statVal([0, 0]),
            a: statVal([0, 0]),
            s: statVal([100, 100]),
            r: statVal(0),
            o: statVal(100)
          }
        ]
      }
    ],
    ip: 0,
    op: FRAMES,
    st: 0,
    bm: 0
  });

  // Layer: Inner Dynamic Neon Ring (Clockwise Fast)
  layers.push({
    ddd: 0,
    ind: layerIndex++,
    ty: 4,
    nm: "Inner Neon Flare Ring",
    sr: 1,
    ks: {
      o: pulseKeyframes(75, 100, FRAMES),
      r: rotateKeyframes(0, 720, FRAMES),
      p: statVal([W / 2, H / 2, 0]),
      a: statVal([0, 0, 0]),
      s: scalePulse(96, 104, FRAMES)
    },
    ao: 0,
    shapes: [
      {
        ty: "gr",
        nm: "Inner Ring",
        it: [
          {
            ty: "el",
            nm: "Circle",
            p: statVal([0, 0]),
            s: statVal([260, 260])
          },
          {
            ty: "st",
            nm: "Stroke",
            c: statVal(COLORS.orangeGlow),
            w: statVal(2.5),
            o: statVal(85),
            lc: 2,
            lj: 2
          },
          {
            ty: "tr",
            p: statVal([0, 0]),
            a: statVal([0, 0]),
            s: statVal([100, 100]),
            r: statVal(0),
            o: statVal(100)
          }
        ]
      }
    ],
    ip: 0,
    op: FRAMES,
    st: 0,
    bm: 0
  });

  // Layer: 4 Cardinal Sparkle Crosses
  for (let c = 0; c < 4; c++) {
    const cardAngle = (c * Math.PI) / 2;
    const dist = 130;
    const cx = Math.cos(cardAngle) * dist;
    const cy = Math.sin(cardAngle) * dist;

    layers.push({
      ddd: 0,
      ind: layerIndex++,
      ty: 4,
      nm: `Cardinal Flare ${c + 1}`,
      sr: 1,
      ks: {
        o: pulseKeyframes(40, 100, FRAMES),
        r: rotateKeyframes(c * 90, c * 90 + 360, FRAMES),
        p: statVal([W / 2 + cx, H / 2 + cy, 0]),
        a: statVal([0, 0, 0]),
        s: scalePulse(70, 130, FRAMES)
      },
      ao: 0,
      shapes: [
        {
          ty: "gr",
          nm: "Cross Sparkle",
          it: [
            // Horizontal line
            {
              ty: "rc",
              p: statVal([0, 0]),
              s: statVal([18, 3]),
              r: statVal(1.5)
            },
            {
              ty: "fl",
              c: statVal(COLORS.white),
              o: statVal(95)
            },
            // Vertical line
            {
              ty: "rc",
              p: statVal([0, 0]),
              s: statVal([3, 18]),
              r: statVal(1.5)
            },
            {
              ty: "fl",
              c: statVal(COLORS.orangeGlow),
              o: statVal(95)
            },
            {
              ty: "tr",
              p: statVal([0, 0]),
              a: statVal([0, 0]),
              s: statVal([100, 100]),
              r: statVal(0),
              o: statVal(100)
            }
          ]
        }
      ],
      ip: 0,
      op: FRAMES,
      st: 0,
      bm: 0
    });
  }

  return {
    v: "5.7.4",
    fr: 60,
    ip: 0,
    op: FRAMES,
    w: W,
    h: H,
    nm: "EventFlow Energy Portal",
    ddd: 0,
    assets: [],
    layers: layers
  };
}

// ============================================================================
// 2. CELEBRATION & COSMIC PARTICLES (Sparkles floating dynamically)
// ============================================================================
function generateParticlesAnimation() {
  const W = 400;
  const H = 800;
  const FRAMES = 180;
  const layers = [];
  let layerIndex = 1;

  const particleData = [
    { x: 50,  y: 120, size: 6, color: COLORS.orange,      dur: 180, offset: 0   },
    { x: 350, y: 90,  size: 5, color: COLORS.indigoBright,dur: 160, offset: 20  },
    { x: 310, y: 220, size: 7, color: COLORS.amber,       dur: 170, offset: 50  },
    { x: 40,  y: 340, size: 5, color: COLORS.cyan,        dur: 190, offset: 80  },
    { x: 370, y: 410, size: 6, color: COLORS.orangeGlow,  dur: 175, offset: 30  },
    { x: 30,  y: 560, size: 7, color: COLORS.white,       dur: 185, offset: 90  },
    { x: 340, y: 620, size: 5, color: COLORS.orange,      dur: 165, offset: 110 },
    { x: 80,  y: 710, size: 6, color: COLORS.indigoBright,dur: 170, offset: 40  },
    { x: 260, y: 760, size: 7, color: COLORS.amber,       dur: 180, offset: 70  },
    { x: 190, y: 80,  size: 4, color: COLORS.white,       dur: 150, offset: 15  },
    { x: 220, y: 390, size: 5, color: COLORS.cyan,        dur: 195, offset: 100 },
    { x: 160, y: 670, size: 4, color: COLORS.orange,      dur: 160, offset: 60  },
    { x: 100, y: 250, size: 5, color: COLORS.indigoBright,dur: 180, offset: 85  },
    { x: 290, y: 510, size: 6, color: COLORS.white,       dur: 170, offset: 120 },
  ];

  particleData.forEach((p, idx) => {
    const floatAmount = 14 + (idx % 8);
    layers.push({
      ddd: 0,
      ind: layerIndex++,
      ty: 4,
      nm: `Sparkle ${idx + 1}`,
      sr: 1,
      ks: {
        o: pulseKeyframes(25, 95, FRAMES),
        r: rotateKeyframes(0, 360, FRAMES),
        p: {
          a: 1,
          k: [
            {
              t: 0,
              s: [p.x, p.y, 0],
              i: { x: [0.45], y: [1] },
              o: { x: [0.55], y: [0] }
            },
            {
              t: FRAMES / 2,
              s: [p.x + (idx % 2 === 0 ? 8 : -8), p.y - floatAmount, 0],
              i: { x: [0.45], y: [1] },
              o: { x: [0.55], y: [0] }
            },
            {
              t: FRAMES,
              s: [p.x, p.y, 0]
            }
          ]
        },
        a: statVal([0, 0, 0]),
        s: scalePulse(70, 140, FRAMES)
      },
      ao: 0,
      shapes: [
        {
          ty: "gr",
          nm: "Particle Shape",
          it: [
            // If even, sparkle cross; if odd, glowing diamond
            idx % 2 === 0
              ? {
                  ty: "rc",
                  p: statVal([0, 0]),
                  s: statVal([p.size * 2.8, p.size * 0.7]),
                  r: statVal(1)
                }
              : {
                  ty: "el",
                  p: statVal([0, 0]),
                  s: statVal([p.size, p.size])
                },
            {
              ty: "fl",
              c: statVal(p.color),
              o: statVal(90)
            },
            {
              ty: "tr",
              p: statVal([0, 0]),
              a: statVal([0, 0]),
              s: statVal([100, 100]),
              r: statVal(idx % 2 === 0 ? 45 : 0),
              o: statVal(100)
            }
          ]
        }
      ],
      ip: 0,
      op: FRAMES,
      st: 0,
      bm: 0
    });
  });

  return {
    v: "5.7.4",
    fr: 60,
    ip: 0,
    op: FRAMES,
    w: W,
    h: H,
    nm: "EventFlow Particles",
    ddd: 0,
    assets: [],
    layers: layers
  };
}

// ============================================================================
// 3. CYBER PULSE LOADER (Futuristic sleek loading scanner)
// ============================================================================
function generateLoaderAnimation() {
  const W = 320;
  const H = 40;
  const FRAMES = 120;
  const layers = [];
  let layerIndex = 1;

  // Background track
  layers.push({
    ddd: 0,
    ind: layerIndex++,
    ty: 4,
    nm: "Track",
    sr: 1,
    ks: {
      o: statVal(30),
      r: statVal(0),
      p: statVal([W / 2, H / 2, 0]),
      a: statVal([0, 0, 0]),
      s: statVal([100, 100, 100])
    },
    ao: 0,
    shapes: [
      {
        ty: "gr",
        nm: "Track Rect",
        it: [
          {
            ty: "rc",
            p: statVal([0, 0]),
            s: statVal([W, 4]),
            r: statVal(2)
          },
          {
            ty: "fl",
            c: statVal(COLORS.white),
            o: statVal(15)
          },
          {
            ty: "tr",
            p: statVal([0, 0]),
            a: statVal([0, 0]),
            s: statVal([100, 100]),
            r: statVal(0),
            o: statVal(100)
          }
        ]
      }
    ],
    ip: 0,
    op: FRAMES,
    st: 0,
    bm: 0
  });

  // Sweeping Neon Laser Beam
  layers.push({
    ddd: 0,
    ind: layerIndex++,
    ty: 4,
    nm: "Laser Beam",
    sr: 1,
    ks: {
      o: pulseKeyframes(70, 100, FRAMES),
      r: statVal(0),
      p: {
        a: 1,
        k: [
          {
            t: 0,
            s: [30, H / 2, 0],
            i: { x: [0.42], y: [1] },
            o: { x: [0.58], y: [0] }
          },
          {
            t: FRAMES / 2,
            s: [W - 30, H / 2, 0],
            i: { x: [0.42], y: [1] },
            o: { x: [0.58], y: [0] }
          },
          {
            t: FRAMES,
            s: [30, H / 2, 0]
          }
        ]
      },
      a: statVal([0, 0, 0]),
      s: scalePulse(80, 120, FRAMES)
    },
    ao: 0,
    shapes: [
      {
        ty: "gr",
        nm: "Beam Head",
        it: [
          // Outer glow bead
          {
            ty: "el",
            p: statVal([0, 0]),
            s: statVal([18, 18])
          },
          {
            ty: "fl",
            c: statVal(COLORS.orange),
            o: statVal(40)
          },
          // Core bright bead
          {
            ty: "el",
            p: statVal([0, 0]),
            s: statVal([8, 8])
          },
          {
            ty: "fl",
            c: statVal(COLORS.white),
            o: statVal(100)
          },
          {
            ty: "tr",
            p: statVal([0, 0]),
            a: statVal([0, 0]),
            s: statVal([100, 100]),
            r: statVal(0),
            o: statVal(100)
          }
        ]
      }
    ],
    ip: 0,
    op: FRAMES,
    st: 0,
    bm: 0
  });

  return {
    v: "5.7.4",
    fr: 60,
    ip: 0,
    op: FRAMES,
    w: W,
    h: H,
    nm: "EventFlow Cyber Loader",
    ddd: 0,
    assets: [],
    layers: layers
  };
}

// Write the files
const portal = generatePortalAnimation();
fs.writeFileSync(path.join(LOTTIE_DIR, 'eventflow-portal.json'), JSON.stringify(portal, null, 2));
console.log('✓ Generated eventflow-portal.json (' + portal.layers.length + ' layers)');

const particles = generateParticlesAnimation();
fs.writeFileSync(path.join(LOTTIE_DIR, 'eventflow-particles.json'), JSON.stringify(particles, null, 2));
console.log('✓ Generated eventflow-particles.json (' + particles.layers.length + ' layers)');

const loader = generateLoaderAnimation();
fs.writeFileSync(path.join(LOTTIE_DIR, 'eventflow-loader.json'), JSON.stringify(loader, null, 2));
console.log('✓ Generated eventflow-loader.json (' + loader.layers.length + ' layers)');
