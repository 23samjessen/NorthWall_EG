export function NWMark({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 58 42" fill="none" aria-hidden="true"><path d="M4 36V6L25 36V6M28 6L34 36L43 15L52 36L56 6" stroke="currentColor" strokeWidth="5" strokeLinejoin="miter" strokeLinecap="square"/></svg>;
}
export function Brand({ light = false }: { light?: boolean }) {
  return <a className={`nw-brand ${light ? 'nw-brand-light' : ''}`} href="/" aria-label="NorthWallEg home"><span className="nw-brand-mark"><NWMark/></span><span>NorthWall<span className="nw-brand-eg">Eg</span><small>IT. SECURITY. PEOPLE.</small></span></a>;
}
