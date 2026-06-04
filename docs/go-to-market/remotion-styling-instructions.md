# Guía Técnica de Remotion: Estilos, Animaciones y Sincronización

Esta guía contiene las especificaciones técnicas y estándares de código de Remotion para la renderización de los videos de Trust Leaf. Debe ser consumida por el agente encargado del desarrollo del proyecto de video.

---

## 🛠️ Configuración de Composición 9:16 (Vertical)

Todas las composiciones en el archivo `Root.tsx` de Remotion deben seguir estrictamente esta definición:

```tsx
import { Composition } from 'remotion';
import { MainVideo } from './src/MainVideo';

export const Root = () => {
  return (
    <Composition
      id="TrustLeafPitchVertical"
      component={MainVideo}
      durationInFrames={1800} // 60 segundos a 30fps
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{
        voiceoverUrl: 'audio/voiceover-exec.mp3',
        subtitlesJson: 'data/subtitles-exec.json'
      }}
    />
  );
};
```

---

## 🎨 Sistema de Diseño (Theme Mapping)

Para lograr una perfecta coherencia visual con la dApp, utiliza las siguientes constantes CSS mapeadas en Tailwind v4 o CSS tradicional:

### Variables CSS Centralizadas
```css
:root {
  --color-brand-green-deep: #1a3b32; /* Fondo primario elegante */
  --color-brand-green-mid: #2d5a4c;  /* Resaltados y bordes */
  --color-brand-ivory: #f2f6f2;      /* Textos secundarios y fondos claros */
  --color-brand-neutral: #e7ece7;    /* Bordes sutiles y tarjetas */
  --color-brand-gold: #c5a47e;       /* Destacados, botones y acentos */
  
  --font-serif: "Playfair Display", ui-serif, Georgia, serif;
  --font-sans: "Instrument Sans", "Inter", ui-sans-serif, system-ui, sans-serif;
}
```

### Reglas de Estilo de Remotion (Best Practices)
1. **No usar componentes de video tradicionales** si es posible representar interfaces en código. Crear maquetas de interfaces de usuario directamente en React para garantizar textos nítidos en la renderización final.
2. **Efecto Glassmorphism Premium:**
   ```tsx
   export const glassStyle: React.CSSProperties = {
     background: 'rgba(26, 59, 50, 0.65)',
     backdropFilter: 'blur(12px)',
     WebkitBackdropFilter: 'blur(12px)',
     border: '1px solid rgba(197, 164, 126, 0.25)', // Borde sutil dorado
     borderRadius: '24px',
   };
   ```

---

## 🔄 Principios de Animación y Curvas de Transición

Las transiciones en Remotion deben sentirse orgánicas y fluidas utilizando dinámicas físicas de resortes (`spring`) o interpolaciones con curvas Bézier.

### 1. Entrada con Rebote Suave (Spring)
Ideal para la entrada de tarjetas médicas, popups y el lector de huella.

```tsx
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';

const frame = useCurrentFrame();
const { fps } = useVideoConfig();

const entranceOffset = spring({
  frame: frame - 15, // Comienza en el frame 15
  fps,
  config: {
    damping: 15,  // Menor valor = más rebote
    mass: 0.8,     // Menor valor = más aceleración
    stiffness: 100 // Tensión del resorte
  }
});

// El offset va de 0 a 1. Mapear al estilo CSS:
const translateY = (1 - entranceOffset) * 200; // Se desliza 200px hacia arriba
const opacity = entranceOffset;
```

### 2. Interpolación Lineal y Rotación
Ideal para giros de logotipos, barras de progreso y destellos de fondo.

```tsx
import { interpolate } from 'remotion';

const progress = interpolate(frame, [0, 90], [0, 1], {
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp'
});

// Mapear a escala o rotación
const scale = interpolate(progress, [0, 1], [0.95, 1]);
```

---

## 🎙️ Sincronización de Audio & Subtítulos Dinámicos

Para coordinar la locución de ElevenLabs con los textos del video, utiliza un archivo JSON de subtítulos estructurado con marcas de tiempo en segundos.

### Formato del archivo `subtitles-exec.json`
```json
[
  { "text": "¿Cómo", "start": 0.1, "end": 0.5 },
  { "text": "resuelves", "start": 0.5, "end": 1.0 },
  { "text": "el", "start": 1.0, "end": 1.2 },
  { "text": "control", "start": 1.2, "end": 1.8 }
]
```

### Componente de Subtítulos Cinéticos (Efecto Karaoke)
```tsx
import { useCurrentFrame, useVideoConfig } from 'remotion';

interface SubtitleWord {
  text: string;
  start: number;
  end: number;
}

export const KineticSubtitles: React.FC<{
  words: SubtitleWord[];
}> = ({ words }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTime = frame / fps;

  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      justifyContent: 'center',
      padding: '0 40px',
      fontFamily: 'var(--font-sans)',
      fontSize: '44px',
      fontWeight: 600,
      textAlign: 'center',
      lineHeight: '1.4'
    }}>
      {words.map((word, index) => {
        const isActive = currentTime >= word.start && currentTime <= word.end;
        const hasPassed = currentTime > word.end;
        
        return (
          <span
            key={index}
            style={{
              marginRight: '12px',
              color: isActive 
                ? 'var(--color-brand-gold)' 
                : hasPassed 
                  ? 'var(--color-brand-ivory)' 
                  : 'rgba(242, 246, 242, 0.35)',
              transform: isActive ? 'scale(1.1)' : 'scale(1)',
              transition: 'transform 0.1s ease-out, color 0.1s ease-out',
              display: 'inline-block'
            }}
          >
            {word.text}
          </span>
        );
      })}
    </div>
  );
};
```

---

## 🎛️ Componentes de UI Reutilizables para Remotion

A continuación se presentan los fragmentos de código para renderizar las maquetas clave que muestran las funcionalidades de Trust Leaf de forma nítida.

### 1. Tarjeta de Receta Digital (NFT)
```tsx
export const RecipeCard: React.FC<{ progress: number }> = ({ progress }) => {
  return (
    <div style={{
      ...glassStyle,
      width: '80%',
      padding: '32px',
      color: 'var(--color-brand-ivory)',
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
      boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
      transform: `scale(${progress})`,
      opacity: progress
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '20px', letterSpacing: '2px', color: 'var(--color-brand-gold)' }}>RECETA ON-CHAIN</span>
        <span style={{ fontSize: '14px', background: 'rgba(197, 164, 126, 0.15)', padding: '4px 12px', borderRadius: '12px' }}>Testnet</span>
      </div>
      <div>
        <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '32px', margin: 0 }}>RX-9402-CAN</h3>
        <p style={{ fontSize: '16px', opacity: 0.7, margin: '4px 0 0 0' }}>Superintendencia de Salud Registrado</p>
      </div>
      <div style={{ borderBottom: '1px solid rgba(242, 246, 242, 0.1)' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <span style={{ fontSize: '14px', opacity: 0.5 }}>Tratamiento</span>
          <p style={{ margin: '4px 0 0 0', fontWeight: 600 }}>Cannabis Sativa L.</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '14px', opacity: 0.5 }}>Cupo Restante</span>
          <p style={{ margin: '4px 0 0 0', color: 'var(--color-brand-gold)', fontWeight: 600 }}>18.5 Gramos</p>
        </div>
      </div>
    </div>
  );
};
```

### 2. Animación Biométrica (Passkey Auth)
```tsx
export const BiometricFingerprint: React.FC<{ progress: number }> = ({ progress }) => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '24px',
      transform: `translateY(${(1 - progress) * 50}px)`,
      opacity: progress
    }}>
      <div style={{
        width: '120px',
        height: '120px',
        borderRadius: '60px',
        border: '3px solid var(--color-brand-gold)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'rgba(197, 164, 126, 0.05)',
        boxShadow: `0 0 ${progress * 30}px rgba(197, 164, 126, 0.4)`
      }}>
        {/* SVG de Huella Dactilar */}
        <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="var(--color-brand-gold)" strokeWidth="1.5" strokeLinecap="round">
          <path d="M12 2a10 10 0 0 0-10 10" />
          <path d="M12 6a6 6 0 0 0-6 6" />
          <path d="M12 10a2 2 0 0 0-2 2" />
          <path d="M12 14c1.1 0 2-.9 2-2" />
          <path d="M12 18c3.31 0 6-2.69 6-6" />
          <path d="M12 22c5.52 0 10-4.48 10-10" />
        </svg>
      </div>
      <span style={{
        fontFamily: 'var(--font-sans)',
        fontSize: '20px',
        color: 'var(--color-brand-ivory)',
        letterSpacing: '1px',
        opacity: 0.9
      }}>
        FIRMANDO CON PASSKEY...
      </span>
    </div>
  );
};
```
