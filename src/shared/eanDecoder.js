const L = ["0001101","0011001","0010011","0111101","0100011","0110001","0101111","0111011","0110111","0001011"];
const G = ["0100111","0110011","0011011","0100001","0011101","0111001","0000101","0010001","0001001","0010111"];
const R = ["1110010","1100110","1101100","1000010","1011100","1001110","1010000","1000100","1001000","1110100"];
const PARITY = ["LLLLLL","LLGLGG","LLGGLG","LLGGGL","LGLLGG","LGGLLG","LGGGLL","LGLGLG","LGLGGL","LGGLGL"];
const hamming = (a, b) => { let n = 0; for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) n += 1; return n; };
const closest = (bits, sets) => { let best; sets.forEach((set, type) => set.forEach((pattern, digit) => { const distance = hamming(bits, pattern); if (!best || distance < best.distance) best = { digit, type, distance }; })); return best?.distance <= 1 ? best : null; };
export const validEanCheckDigit = (code) => { const digits = [...code].map(Number); const check = digits.pop(); const sum = digits.reverse().reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1), 0); return (10 - sum % 10) % 10 === check; };

export function decodeEanBits(bits) {
  if (bits.length === 95 && bits.slice(0,3) === "101" && bits.slice(45,50) === "01010" && bits.slice(92) === "101") {
    let left = "", parity = "", errors = 0; for (let i = 0; i < 6; i += 1) { const found = closest(bits.slice(3+i*7,10+i*7), [L,G]); if (!found) return null; left += found.digit; parity += found.type ? "G" : "L"; errors += found.distance; }
    const first = PARITY.indexOf(parity); if (first < 0) return null; let right = ""; for (let i = 0; i < 6; i += 1) { const found = closest(bits.slice(50+i*7,57+i*7), [R]); if (!found) return null; right += found.digit; errors += found.distance; }
    const code = `${first}${left}${right}`; return errors <= 3 && validEanCheckDigit(code) ? code : null;
  }
  if (bits.length === 67 && bits.slice(0,3) === "101" && bits.slice(31,36) === "01010" && bits.slice(64) === "101") {
    let code = "", errors = 0; for (let i = 0; i < 4; i += 1) { const found = closest(bits.slice(3+i*7,10+i*7), [L]); if (!found) return null; code += found.digit; errors += found.distance; } for (let i = 0; i < 4; i += 1) { const found = closest(bits.slice(36+i*7,43+i*7), [R]); if (!found) return null; code += found.digit; errors += found.distance; }
    return errors <= 2 && validEanCheckDigit(code) ? code : null;
  }
  return null;
}

export function decodeEanLine(values) {
  let min = 255, max = 0; for (const value of values) { min = Math.min(min,value); max = Math.max(max,value); } if (max-min < 50) return null; const threshold = (min+max)/2; const binary = values.map((value) => value < threshold ? 1 : 0); const transitions = []; for (let i=1;i<binary.length;i+=1) if(binary[i]!==binary[i-1]) transitions.push(i);
  for(let t=0;t<transitions.length-3;t+=1){const start=transitions[t];if(!binary[start])continue;const base=((transitions[t+1]-start)+(transitions[t+2]-transitions[t+1])+(transitions[t+3]-transitions[t+2]))/3;for(const length of [95,67])for(const scale of [.82,.88,.94,.97,1,1.03,1.06,1.12,1.18]){const moduleSize=base*scale;if(start+moduleSize*length>=binary.length)continue;let bits="";for(let m=0;m<length;m+=1)bits+=binary[Math.min(binary.length-1,Math.round(start+(m+.5)*moduleSize))]?"1":"0";const decoded=decodeEanBits(bits)||decodeEanBits([...bits].reverse().join(""));if(decoded)return decoded;}}
  return null;
}

export function decodeEanFromVideo(video, canvas) {
  if(!video?.videoWidth||!video?.videoHeight)return null;const width=Math.min(1280,video.videoWidth),height=Math.round(width*video.videoHeight/video.videoWidth);canvas.width=width;canvas.height=height;const context=canvas.getContext("2d",{willReadFrequently:true});context.drawImage(video,0,0,width,height);const pixels=context.getImageData(0,0,width,height).data;
  for(const ratio of [.28,.34,.4,.46,.5,.54,.6,.66,.72])for(const slope of [0,-.035,.035,-.07,.07]){const centerY=height*ratio,gray=[];for(let x=0;x<width;x+=1){const y=Math.max(1,Math.min(height-2,Math.round(centerY+(x-width/2)*slope)));let total=0;for(let dy=-1;dy<=1;dy+=1){const offset=(y+dy)*width*4+x*4;total+=(pixels[offset]*77+pixels[offset+1]*150+pixels[offset+2]*29)>>8;}gray.push(total/3);}const result=decodeEanLine(gray);if(result)return result;}return null;
}
