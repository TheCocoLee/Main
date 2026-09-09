import Link from 'next/link';

export default function Nav() {
  return (
    <nav className="nav">
      <Link href="/" className="brand">
        <span className="glyph" aria-hidden="true" />
        Arc
      </Link>
      <div className="navlinks">
        <Link href="/">Prism</Link>
        <Link href="/board">Master Board</Link>
        <Link href="/songs">Song Production</Link>
      </div>
      <span className="right mono">thecocolee</span>
    </nav>
  );
}
