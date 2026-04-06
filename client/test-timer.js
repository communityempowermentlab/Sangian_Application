const TIMER_LIMITS = { q1: 90, q2: 90 };
let currentKey = 'q1';
let timeElapsed = 0;
let timeRemaining = 0;
let timerRef = null;

function render() {
  const limit = TIMER_LIMITS[currentKey] || 0;
  console.log(`Render: currentKey=${currentKey}, limit=${limit}, timeRemaining=${timeRemaining}`);
  
  if (timerRef) clearInterval(timerRef);
  timeElapsed = 0;
  timeRemaining = limit;
  timerRef = setInterval(() => {
    timeElapsed++;
    if (limit > 0) {
      timeRemaining--;
    }
  }, 10);
}

render();
setTimeout(() => {
  currentKey = 'q2';
  render();
}, 25);
