import { useId } from 'react'

export type Pose = 'sit' | 'wave' | 'read' | 'sleep'
export type Mood = 'calm' | 'happy' | 'sad' | 'sleepy' | 'thinking' | 'love' | 'surprised'
export type Accessory = 'none' | 'glasses' | 'scarf' | 'nightcap' | 'flower'
export type BunnyState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error'

interface Props {
  pose?: Pose; mood?: Mood; accessory?: Accessory; state?: BunnyState
  size?: number | string; animate?: boolean; shadow?: boolean; className?: string; title?: string
}

const INK = '#8b6f68'
const EYE = '#4a3638'

/**
 * Mallow, the one and only mascot. A soft, pencil-and-watercolour plush bunny:
 * oversized round head, long floppy ears with pink insides, tiny dark eyes, rosy cheeks,
 * a dusty-rose bow and heart-shaped paw pads. Poses/moods/accessories change; the character never does.
 */
export default function Bunny({ pose = 'sit', mood = 'calm', accessory = 'none', state = 'idle', size = 220, animate = true, shadow = true, className = '', title = 'Mallow the bunny' }: Props) {
  const uid = useId().replace(/:/g, '')
  const id = (n: string) => `${n}-${uid}`
  const effective: Mood = state === 'thinking' ? 'thinking' : state === 'error' ? 'sad' : state === 'speaking' && mood === 'calm' ? 'happy' : mood
  const sleeping = pose === 'sleep' || effective === 'sleepy'
  const speaking = state === 'speaking'
  const listening = state === 'listening'
  const ink = { stroke: INK, strokeWidth: 2.3, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }

  return (
    <svg viewBox="0 0 300 330" width={size} height={typeof size === 'number' ? size * 1.1 : undefined} className={className} role="img" aria-label={title} style={{ overflow: 'visible' }}>
      <title>{title}</title>
      <defs>
        <radialGradient id={id('fur')} cx="38%" cy="28%" r="80%">
          <stop offset="0" stopColor="#FFFCF6" /><stop offset=".6" stopColor="#FFF1E2" /><stop offset="1" stopColor="#F5DDC9" />
        </radialGradient>
        <radialGradient id={id('belly')} cx="50%" cy="40%" r="70%"><stop offset="0" stopColor="#FFFDF8" /><stop offset="1" stopColor="#FBEBDC" /></radialGradient>
        <linearGradient id={id('ear')} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FFCDD3" /><stop offset="1" stopColor="#F9B4C1" /></linearGradient>
        <linearGradient id={id('bow')} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#E6B2BF" /><stop offset="1" stopColor="#C98699" /></linearGradient>
        <linearGradient id={id('blanket')} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#E4DAF5" /><stop offset="1" stopColor="#CDBDEB" /></linearGradient>
        <filter id={id('wobble')} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="7" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="3.2" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id={id('soft')}><feGaussianBlur stdDeviation="6" /></filter>
        <filter id={id('blush')}><feGaussianBlur stdDeviation="3.2" /></filter>
      </defs>

      {shadow && <ellipse cx="150" cy="312" rx="88" ry="11" fill="#CDBDEB" opacity=".45" filter={`url(#${id('soft')})`} />}

      <g className={animate && state !== 'error' ? 'bunny-idle' : ''} filter={`url(#${id('wobble')})`}>
        {/* ---------- body / blanket ---------- */}
        {pose !== 'sleep' ? (
          <g>
            <path d="M104 176 C78 214 80 268 116 290 C140 302 162 302 186 290 C222 268 224 214 198 176 Z" fill={`url(#${id('fur')})`} {...ink} />
            <ellipse cx="151" cy="248" rx="38" ry="36" fill={`url(#${id('belly')})`} opacity=".9" />
            {/* feet with heart paw pads */}
            {[[104, -10], [196, 10]].map(([cx, r], i) => (
              <g key={i} transform={`rotate(${r} ${cx} 296)`}>
                <ellipse cx={cx} cy="296" rx="29" ry="17" fill={`url(#${id('fur')})`} {...ink} />
                <path d={`M${cx} 301 C${cx - 9} 294 ${cx - 7} 287 ${cx} 291 C${cx + 7} 287 ${cx + 9} 294 ${cx} 301Z`} fill="#F4A0B2" stroke="#E58A9E" strokeWidth="1" />
                {[-11, -4, 4, 11].map((dx, k) => <ellipse key={k} cx={cx + dx} cy={k === 1 || k === 2 ? 283 : 285} rx="2.6" ry="3.2" fill="#F8B6C4" />)}
              </g>
            ))}
          </g>
        ) : (
          <g>
            <ellipse cx="150" cy="268" rx="104" ry="44" fill={`url(#${id('fur')})`} {...ink} />
            <path d="M40 262 C70 246 230 246 262 262 L270 312 C220 326 80 326 30 312 Z" fill={`url(#${id('blanket')})`} {...ink} />
            {[78, 118, 158, 198, 238].map((x, i) => <path key={i} d={`M${x} ${284 + (i % 2) * 8} c-5 -6 -13 0 -7 7 c3 3 7 5 7 5 c0 0 4 -2 7 -5 c6 -7 -2 -13 -7 -7z`} fill="#fff" opacity=".7" />)}
            <path d="M44 270 C100 258 200 258 258 270" fill="none" stroke="#fff" strokeWidth="2.2" strokeDasharray="5 6" opacity=".85" />
          </g>
        )}

        {/* ---------- arms ---------- */}
        {pose === 'sit' && [[98, 230, 18], [204, 230, -18]].map(([cx, cy, r], i) => <ellipse key={i} cx={cx} cy={cy} rx="14" ry="27" transform={`rotate(${r} ${cx} ${cy})`} fill={`url(#${id('fur')})`} {...ink} />)}
        {pose === 'wave' && (<>
          <ellipse cx="98" cy="230" rx="14" ry="27" transform="rotate(18 98 230)" fill={`url(#${id('fur')})`} {...ink} />
        </>)}
        {pose === 'read' && (<g>
          <path d="M96 238 Q124 226 151 240 Q178 226 206 238 L206 284 Q178 274 151 288 Q124 274 96 284 Z" fill="#fff" {...ink} />
          <path d="M92 244 L96 238 L96 284 L92 290 Q124 280 151 294 Q178 280 210 290 L206 284 L206 238 L210 244 L210 292 Q178 280 151 296 Q124 280 92 292 Z" fill="#C9B6E4" {...ink} />
          <path d="M151 240 L151 288" stroke={INK} strokeWidth="1.8" />
          {[250, 258, 266].map((y) => <g key={y}><path d={`M104 ${y} Q124 ${y - 6} 143 ${y}`} stroke="#D8C9EE" strokeWidth="2" fill="none" /><path d={`M159 ${y} Q178 ${y - 6} 198 ${y}`} stroke="#D8C9EE" strokeWidth="2" fill="none" /></g>)}
          <ellipse cx="102" cy="238" rx="13" ry="15" fill={`url(#${id('fur')})`} {...ink} />
          <ellipse cx="200" cy="238" rx="13" ry="15" fill={`url(#${id('fur')})`} {...ink} />
        </g>)}

        {/* ---------- head group (tilts when listening) ---------- */}
        <g transform={sleeping && pose === 'sleep' ? 'rotate(-8 150 150) translate(-4 40)' : listening ? 'rotate(-5 150 150)' : ''}>
          {pose === 'sleep' && <ellipse cx="150" cy="214" rx="82" ry="22" fill="#FBDDE3" {...ink} transform="translate(0 4)" />}
          {/* head */}
          <path d="M72 124 C72 70 108 48 150 48 C192 48 228 70 228 124 C228 168 196 192 150 192 C104 192 72 168 72 124Z" fill={`url(#${id('fur')})`} {...ink} />
          <path d="M104 62 q8 -8 16 -2 M180 60 q8 -6 16 2" stroke="#EBD3BE" strokeWidth="2" fill="none" strokeLinecap="round" />
          {/* ears: floppy, pink inside, hanging in front of the head edges */}
          <g className={animate ? 'bunny-ear-l' : ''}>
            <g className={listening ? 'bunny-ear-up' : ''} style={{ transformBox: 'fill-box', transformOrigin: '85% 10%' }}>
              <path d="M100 70 C64 42 26 72 28 120 C30 164 52 200 78 194 C102 188 108 134 112 94 Z" fill={`url(#${id('fur')})`} {...ink} />
              <path d="M98 84 C74 66 50 88 52 122 C54 152 64 174 77 170 C92 166 96 130 100 104 Z" fill={`url(#${id('ear')})`} opacity=".8" />
              <path d="M62 112 q3 20 10 36" stroke="#F18FA3" strokeWidth="1.6" fill="none" opacity=".6" strokeLinecap="round" />
            </g>
          </g>
          <g transform="translate(300 0) scale(-1 1)">
            <g className={animate ? 'bunny-ear-r' : ''} style={{ transformBox: 'fill-box', transformOrigin: '85% 10%' }}>
              <path d="M100 70 C64 42 26 72 28 120 C30 164 52 200 78 194 C102 188 108 134 112 94 Z" fill={`url(#${id('fur')})`} {...ink} />
              <path d="M98 84 C74 66 50 88 52 122 C54 152 64 174 77 170 C92 166 96 130 100 104 Z" fill={`url(#${id('ear')})`} opacity=".8" />
              <path d="M62 112 q3 20 10 36" stroke="#F18FA3" strokeWidth="1.6" fill="none" opacity=".5" strokeLinecap="round" />
            </g>
          </g>

          {/* cheeks */}
          <ellipse cx="104" cy="144" rx="15" ry="9" fill="#F6A8B2" opacity=".6" filter={`url(#${id('blush')})`} />
          <ellipse cx="196" cy="144" rx="15" ry="9" fill="#F6A8B2" opacity=".6" filter={`url(#${id('blush')})`} />
          {effective === 'love' && <><ellipse cx="104" cy="144" rx="17" ry="11" fill="#F58FA0" opacity=".35" /><ellipse cx="196" cy="144" rx="17" ry="11" fill="#F58FA0" opacity=".35" /></>}

          {/* eyes */}
          <Eyes mood={sleeping ? 'sleepy' : effective} animate={animate} />
          {/* nose + mouth */}
          <path d="M143 134 C145 130 155 130 157 134 C156 139 150 142 150 142 C150 142 144 139 143 134Z" fill="#EA8FA0" stroke="#D97A8E" strokeWidth="1" />
          {speaking ? (
            <ellipse className={animate ? 'bunny-mouth-talk' : ''} cx="150" cy="152" rx="6.5" ry="5.5" fill="#B5586C" stroke={INK} strokeWidth="1.6" />
          ) : effective === 'sad' ? (
            <path d="M150 142 L150 146 M150 146 C146 144 141 147 140 151 M150 146 C154 144 159 147 160 151" stroke="#7a5a5a" strokeWidth="1.9" fill="none" strokeLinecap="round" />
          ) : effective === 'surprised' ? (
            <ellipse cx="150" cy="151" rx="4" ry="5" fill="#B5586C" stroke={INK} strokeWidth="1.4" />
          ) : (
            <path d="M150 142 L150 147 M150 147 C146 153 140 151 139 147 M150 147 C154 153 160 151 161 147" stroke="#7a5a5a" strokeWidth="1.9" fill="none" strokeLinecap="round" />
          )}
          {/* accessories on the head */}
          {accessory === 'glasses' && (<g fill="#fff" fillOpacity=".25" stroke="#7a6485" strokeWidth="2.6">
            <circle cx="122" cy="118" r="17" /><circle cx="178" cy="118" r="17" /><path d="M139 117 q11 -6 22 0" fill="none" />
            <path d="M105 114 l-9 -3 M195 114 l9 -3" fill="none" />
          </g>)}
          {accessory === 'nightcap' && (<g>
            <path d="M82 84 C90 40 150 22 210 62 C222 70 224 84 216 88 C170 66 120 72 82 84Z" fill="#CDBDEB" {...ink} />
            <path d="M80 86 Q150 62 220 90" stroke="#fff" strokeWidth="9" strokeLinecap="round" fill="none" opacity=".75" />
            <circle cx="214" cy="66" r="10" fill="#FFF8F0" {...ink} />
          </g>)}
          {accessory === 'flower' && (<g transform="translate(196 62)">
            {[0, 72, 144, 216, 288].map((a) => <ellipse key={a} cx="0" cy="-8" rx="6" ry="9" fill="#FFD3DA" stroke="#D99AAA" strokeWidth="1.4" transform={`rotate(${a})`} />)}
            <circle r="5" fill="#FFE59A" stroke="#E0B94E" strokeWidth="1.2" />
          </g>)}
        </g>

        {pose === 'wave' && (
          <g className={animate ? 'origin-bottom-left animate-wiggle' : ''} style={{ transformBox: 'fill-box', transformOrigin: '20% 90%' }}>
            <ellipse cx="250" cy="206" rx="14" ry="29" transform="rotate(24 250 206)" fill={`url(#${id('fur')})`} {...ink} />
            <ellipse cx="262" cy="180" rx="5" ry="6" fill="#F8B6C4" opacity=".8" />
          </g>
        )}
        {/* ---------- bow / scarf ---------- */}
        {pose !== 'sleep' && (accessory === 'scarf' ? (
          <g>
            <path d="M96 188 C130 206 170 206 204 188 L208 206 C172 224 128 224 92 206 Z" fill="#9CCACB" {...ink} />
            <path d="M176 210 L190 252 L168 248 L162 214Z" fill="#8BBFC0" {...ink} />
            {[110, 130, 150, 170, 190].map((x) => <path key={x} d={`M${x} 198 l6 14`} stroke="#fff" strokeWidth="2" opacity=".6" />)}
          </g>
        ) : (
          <g>
            <path d="M149 194 C124 170 94 180 100 198 C106 214 134 208 149 198Z" fill={`url(#${id('bow')})`} {...ink} />
            <path d="M151 194 C176 170 206 180 200 198 C194 214 166 208 151 198Z" fill={`url(#${id('bow')})`} {...ink} />
            <path d="M143 199 L130 226 L146 219Z M157 199 L170 226 L154 219Z" fill="#C98699" {...ink} />
            <path d="M118 192 q10 -2 20 6 M182 192 q-10 -2 -20 6" stroke="#B87489" strokeWidth="1.4" fill="none" opacity=".6" />
            <ellipse cx="150" cy="196" rx="10" ry="9" fill="#D79AAB" {...ink} />
          </g>
        ))}
      </g>

      {/* ---------- floating bits (not wobbled) ---------- */}
      {state === 'thinking' && <g className={animate ? 'animate-twinkle' : ''} fill="#fff" stroke="#CDBDEB" strokeWidth="2"><circle cx="250" cy="70" r="5" /><circle cx="266" cy="48" r="8" /><circle cx="270" cy="12" r="14" /></g>}
      {listening && <g fill="none" stroke="#9D86C9" strokeWidth="3" strokeLinecap="round" opacity=".7">
        <path d="M252 110 q10 14 0 28" className={animate ? 'animate-pulse' : ''} /><path d="M266 100 q16 24 0 48" className={animate ? 'animate-pulse' : ''} />
        <path d="M48 110 q-10 14 0 28" className={animate ? 'animate-pulse' : ''} /><path d="M34 100 q-16 24 0 48" className={animate ? 'animate-pulse' : ''} />
      </g>}
      {speaking && <g fill="none" stroke="#D99AAA" strokeWidth="3" strokeLinecap="round" opacity=".7">
        <path d="M232 150 q10 8 0 18" className={animate ? 'animate-pulse' : ''} /><path d="M246 142 q16 17 0 34" className={animate ? 'animate-pulse' : ''} />
      </g>}
      {pose === 'sleep' && <g fontFamily="Caveat, cursive" fill="#9D86C9" fontWeight="700" className={animate ? 'animate-twinkle' : ''}><text x="226" y="86" fontSize="30">z</text><text x="250" y="58" fontSize="40">z</text><text x="278" y="22" fontSize="50">Z</text></g>}
      {effective === 'love' && <g fill="#F58FA0"><path d="M238 80 c-6 -9 -18 -2 -10 8 l10 9 l10 -9 c8 -10 -4 -17 -10 -8z" /></g>}
    </svg>
  )
}

function Eyes({ mood, animate }: { mood: Mood; animate: boolean }) {
  const blink = animate ? 'bunny-blink' : ''
  if (mood === 'sleepy') return <g stroke={EYE} strokeWidth="2.8" fill="none" strokeLinecap="round"><path d="M112 120 Q122 129 132 120" /><path d="M168 120 Q178 129 188 120" /></g>
  if (mood === 'happy') return <g stroke={EYE} strokeWidth="3" fill="none" strokeLinecap="round"><path d="M112 124 Q122 112 132 124" /><path d="M168 124 Q178 112 188 124" /></g>
  if (mood === 'love') return <g fill="#E8728B">{[122, 178].map((x) => <path key={x} d={`M${x} 128 c-12 -8 -12 -20 -2 -20 c4 0 2 3 2 3 c0 0 -2 -3 2 -3 c10 0 10 12 -2 20z`} transform={`translate(0 0)`} />)}</g>
  const dy = mood === 'thinking' ? -4 : 0; const dx = mood === 'thinking' ? 4 : 0; const ry = mood === 'surprised' ? 9 : 7.4
  return (
    <g className={blink}>
      {[122, 178].map((x) => (
        <g key={x}>
          <ellipse cx={x + dx} cy={120 + dy} rx={mood === 'surprised' ? 6.5 : 5.8} ry={ry} fill={EYE} />
          <circle cx={x + dx - 2} cy={116 + dy} r="2" fill="#fff" /><circle cx={x + dx + 2} cy={124 + dy} r=".9" fill="#fff" opacity=".8" />
        </g>
      ))}
      {mood === 'sad' && <g stroke="#7a5a5a" strokeWidth="2" fill="none" strokeLinecap="round"><path d="M110 104 Q121 98 133 106" /><path d="M190 104 Q179 98 167 106" /></g>}
    </g>
  )
}
