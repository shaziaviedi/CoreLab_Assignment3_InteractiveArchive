export default function FragmentArt({ fragment }) {
  const id="fragment-"+fragment.id;
  const color=fragment.id==="sun" ? "#ffe5b3" : fragment.id==="moon" ? "#ddd8f4" : fragment.target==="tree" ? "#bad3bf" : "#bedbe7";
  return <svg viewBox="0 0 80 80" aria-hidden="true" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.2">
    <defs>
      <radialGradient id={id+"-glow"}><stop stopColor={color} stopOpacity=".55"/><stop offset="1" stopColor={color} stopOpacity="0"/></radialGradient>
      <mask id={id+"-crescent"}><circle cx="40" cy="40" r="18" fill="white"/><circle cx="49" cy="32" r="17" fill="black"/></mask>
    </defs>
    <circle cx="40" cy="40" r="32" fill={`url(#${id}-glow)`}/>
    {fragment.id==="sun" ? <>
      <circle cx="40" cy="40" r="17" fill="#fff4d0"/>
      <circle cx="40" cy="40" r="22" stroke="#ffefe3" opacity=".55"/>
    </> : fragment.id==="moon" ? <circle cx="40" cy="40" r="18" fill="#f4efd7" mask={`url(#${id}-crescent)`}/> : fragment.target==="tree" ? <>
      <path d="m37 43-1 19h8l-1-19Z" fill="#c5b0b9"/>
      <circle cx="29" cy="36" r="12" fill="#a9c6b7"/>
      <circle cx="50" cy="36" r="12" fill="#a9c6b7"/>
      <circle cx="40" cy="28" r="14" fill="#cbdcc2"/>
    </> : fragment.target==="north" ? <>
      <path d="m40 19 24 21-24 21-24-21Z" fill="#29394f" stroke="#c6d6e0"/>
      <path d="m40 28 14 12-14 12-14-12Z" fill="#87b7c6"/>
    </> : <>
      <rect x="24" y="16" width="32" height="48" rx="4" fill="#91a4b8" stroke="#d2dde8"/>
      <path d="M40 23v7m0 7v7m0 7v7" stroke="#f0edf0"/>
    </>}
  </svg>;
}
