const cleanText = "51 - 35";
const isStrictMath = /^\s*\d+\s*[-÷]\s*\d+\s*$/.test(cleanText);
console.log(isStrictMath);
