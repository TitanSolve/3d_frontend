import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

export default function TitleIntro({ onEnter }) {
  const containerRef = useRef(null);
  const titleRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.fromTo(containerRef.current, { opacity: 0 }, { opacity: 1, duration: 1.2 });

    // Animate title character-by-character scale-in
    const chars = titleRef.current?.querySelectorAll('.title-char');
    if (chars && chars.length) {
      tl.fromTo(chars,
        { opacity: 0, scale: 0.85, y: 20 },
        { opacity: 1, scale: 1.0, y: 0, duration: 0.5, stagger: 0.06 },
        '-=0.6'
      );
    } else {
      tl.fromTo(titleRef.current, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 1.0 }, '<');
    }

    tl.fromTo(buttonRef.current, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8 }, '-=0.2');
  }, []);

  // Helper: split string into array of chars, preserving spaces
  const renderTitle = (text) => (
    text.split('').map((char, i) =>
      char === ' '
        ? <span key={i} className="title-space"> </span>
        : <span key={i} className="title-char">{char}</span>
    )
  );

  return (
    <div ref={containerRef} className="title-intro">
      <div className="title-glow" />
      <h1 ref={titleRef} className="title-text">
        {renderTitle('Ancient Fantasy')}
      </h1>
      <button ref={buttonRef} className="enter-btn" onClick={onEnter} aria-label="Enter">
        <img src="/assets/images/door.png" alt="Enter Room" className="enter-icon enter-icon-border" />
      </button>
    </div>
  );
}
