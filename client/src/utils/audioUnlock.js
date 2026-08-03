export const unlockAudioContext = () => {
    // Play a tiny, silent 1px-equivalent audio snippet to unlock iOS Safari Audio Context
    const audio = new Audio("data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAAABmYWN0BAAAAAAAAABkYXRhAAAAAA==");
    audio.play().catch(() => {});
};
