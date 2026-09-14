"""Original deterministic synthesis; no sampled or third-party audio."""
import os, math, wave, struct, random
random.seed(179)
RATE=22050
os.makedirs('public/assets/audio',exist_ok=True)
def write(name,duration,fn):
    count=int(RATE*duration)
    samples=[max(-1,min(1,fn(i/RATE,i/count))) for i in range(count)]
    with wave.open('public/assets/audio/'+name+'.wav','wb') as f:
        f.setnchannels(1);f.setsampwidth(2);f.setframerate(RATE);f.writeframes(b''.join(struct.pack('<h',int(v*26000)) for v in samples))
def tone(freq,t):return math.sin(2*math.pi*freq*t)
for name,freq,dur in [('coin',950,.12),('loot',660,.35),('heal',440,.6),('ring',330,.65),('parry',1200,.22),('boss',60,1.1),('cue',180,.3),('victory',262,1.8)]:
    write(name,dur,lambda t,p,f=freq: (.13*tone(f,t)+.06*tone(f*1.5,t)+.04*tone(f*2,t))*math.sin(math.pi*p)**1.2)
for name,dur,amp,f in [('step',.09,.12,75),('swing',.18,.16,220),('impact',.14,.25,110),('dodge',.23,.09,300),('bow',.17,.13,440),('hurt',.18,.17,80),('break',.3,.2,95)]:
    write(name,dur,lambda t,p,amp=amp,f=f: (random.uniform(-1,1)*.7+tone(f*(1-p*.5),t)*.3)*amp*(1-p)**2)
write('ambience',16,lambda t,p:(random.uniform(-1,1)*.055+.01*tone(110,t))*(.6+.2*math.sin(t*.4)))
notes=[146.832,174.614,220,195.998,130.813,164.814,195.998,174.614]
def music(t,p):
    n=notes[int(t/2)%len(notes)];local=t%2;env=math.sin(math.pi*local/2)**2
    return .13*tone(n,t)*env+.025*tone(73.416,t)+.02*tone(110,t)
write('music',16,music)
print('17 original local WAV assets created')
