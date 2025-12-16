import { useRef } from 'react';

export default function CheckpointModal({ open, onSubmit, onCancel, onMoveForward, onMoveBackward }) {
  const titleRef = useRef();
  const commentRef = useRef();

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSubmit({
        title: titleRef.current.value,
        comment: commentRef.current.value
      });
    } else if (e.key === 'Escape') {
      onCancel();
    }
  }

  if (!open) return null;
  return (
    <div className="checkpoint-modal-overlay">
      <div className="checkpoint-modal">
        <h2>Add Checkpoint</h2>
        <input ref={titleRef} className="checkpoint-title" placeholder="Checkpoint Title" autoFocus onKeyDown={handleKeyDown} />
        <textarea ref={commentRef} className="checkpoint-comment" placeholder="Comment (optional)" onKeyDown={handleKeyDown} />
        <div style={{ display: 'flex', gap: 8, margin: '8px 0' }}>
          <button type="button" onClick={onMoveForward} title="Move Forward">↑</button>
          <button type="button" onClick={onMoveBackward} title="Move Backward">↓</button>
        </div>
        <div className="checkpoint-modal-actions">
          <button onClick={() => onSubmit({ title: titleRef.current.value, comment: commentRef.current.value })}>Save</button>
          <button onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
