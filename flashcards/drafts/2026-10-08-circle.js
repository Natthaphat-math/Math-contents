// ไฟล์ร่างการ์ดจาก Claude — ตรวจและเลือกใช้ใน card-editor.html (ไม่แสดงในแอปจนกว่าจะนำเข้า cards.js)
window.CARD_SOURCE = function () {/*
// จาก: หนังสือเรียนรายวิชาพื้นฐาน คณิตศาสตร์ เล่ม 2 (สสวท.) บทที่ 2 วงกลม หน้า 48–105
// วันที่: 2026-10-08
// ทฤษฎีบทมีทั้งการ์ดของทฤษฎีบทและการ์ดของบทกลับ
// การ์ดที่มีโน้ต "นอกหนังสือ" เป็นบทกลับที่เป็นจริง แต่หนังสือไม่ได้เขียนเป็นกรอบทฤษฎีบท

# บท: วงกลม
# ระดับ: jh
# สัญลักษณ์: ○

# หัวข้อ: บทนิยามเกี่ยวกับวงกลม

== circ-def-arc
ถาม: **บทนิยาม**
**ส่วนโค้งใหญ่** และ **ส่วนโค้งน้อย** คือ ?
ตอบ: เมื่อแบ่งเส้นรอบวงเป็น 2 ส่วนที่ยาวไม่เท่ากัน
ส่วนที่ยาวกว่า = **ส่วนโค้งใหญ่** (สีน้ำเงิน)
ส่วนที่สั้นกว่า = **ส่วนโค้งน้อย** (สีแดง)
ถ้ายาวเท่ากัน แต่ละส่วนเรียกว่า **ครึ่งวงกลม**
เขียน ส่วนโค้ง $AB$ แทนด้วย $\overset{\frown}{AB}$ (หมายถึงส่วนโค้งน้อย)
รูปตอบ:
\begin{tikzpicture}[scale=1]
\draw[thick] (0,0) circle (1.3);
\fill (0.000,0.000) circle (0.04);
\node[above right] at (0.000,0.000) {$O$};
\draw[very thick,red] (1.222,0.445) arc (20.0:160.0:1.30);
\draw[very thick,blue] (-1.222,0.445) arc (160.0:380.0:1.30);
\fill (1.222,0.445) circle (0.04);
\fill (-1.222,0.445) circle (0.04);
\node[left] at (-1.222,0.445) {$A$};
\node[right] at (1.222,0.445) {$B$};
\node[above] at (0.000,1.300) {$D$};
\node[below] at (-0.000,-1.300) {$C$};
\end{tikzpicture}

== circ-def-central
ถาม: **บทนิยาม**
**มุมที่จุดศูนย์กลาง** คือ ?
ตอบ: มุมที่มี**จุดศูนย์กลาง**ของวงกลมเป็นจุดยอดมุม
และแขนทั้งสองของมุมตัดวงกลม
เช่น $A\hat{O}B$
รูปตอบ:
\begin{tikzpicture}[scale=1]
\draw[thick] (0,0) circle (1.3);
\fill (0.000,0.000) circle (0.04);
\node[above] at (0.000,0.000) {$O$};
\draw[thick,blue] (0.000,0.000) -- (-1.126,-0.650);
\draw[thick,blue] (0.000,0.000) -- (1.126,-0.650);
\fill[orange,opacity=0.35] (0.000,0.000) -- ++(-150.0:0.30) arc (-150.0:-30.0:0.30) -- cycle;
\draw[orange] (0.000,0.000) ++(-150.0:0.30) arc (-150.0:-30.0:0.30);
\node[below left] at (-1.126,-0.650) {$A$};
\node[below right] at (1.126,-0.650) {$B$};
\end{tikzpicture}

== circ-def-inscribed
ถาม: **บทนิยาม**
**มุมในส่วนโค้งของวงกลม** คือ ?
ตอบ: มุมที่มี**จุดยอดมุมอยู่บนวงกลม**
และแขนทั้งสองของมุมตัดวงกลม
เช่น $A\hat{B}C$
รูปตอบ:
\begin{tikzpicture}[scale=1]
\draw[thick] (0,0) circle (1.3);
\fill (0.000,0.000) circle (0.04);
\node[right] at (0.000,0.000) {$O$};
\draw[thick,blue] (-0.996,-0.836) -- (0.000,1.300);
\draw[thick,blue] (0.000,1.300) -- (0.996,-0.836);
\fill[orange,opacity=0.35] (0.000,1.300) -- ++(-115.0:0.30) arc (-115.0:-65.0:0.30) -- cycle;
\draw[orange] (0.000,1.300) ++(-115.0:0.30) arc (-115.0:-65.0:0.30);
\node[below left] at (-0.996,-0.836) {$A$};
\node[above] at (0.000,1.300) {$B$};
\node[below right] at (0.996,-0.836) {$C$};
\end{tikzpicture}

== circ-def-semicircle-angle
ถาม: **บทนิยาม**
**มุมในครึ่งวงกลม** คือ ?
ตอบ: มุมในส่วนโค้งของวงกลม
ที่แขนทั้งสองผ่าน**จุดปลายทั้งสองของเส้นผ่านศูนย์กลาง**
เช่น $A\hat{B}C$ เมื่อ $\overline{AC}$ เป็นเส้นผ่านศูนย์กลาง
รูปตอบ:
\begin{tikzpicture}[scale=1]
\draw[thick] (0,0) circle (1.3);
\fill (0.000,0.000) circle (0.04);
\node[below] at (0.000,0.000) {$O$};
\draw[thick,red] (-1.300,0.000) -- (1.300,0.000);
\draw[thick,blue] (-1.300,0.000) -- (-0.549,1.178);
\draw[thick,blue] (-0.549,1.178) -- (1.300,0.000);
\fill[orange,opacity=0.35] (-0.549,1.178) -- ++(-122.5:0.30) arc (-122.5:-32.5:0.30) -- cycle;
\draw[orange] (-0.549,1.178) ++(-122.5:0.30) arc (-122.5:-32.5:0.30);
\node[left] at (-1.300,0.000) {$A$};
\node[above] at (-0.549,1.178) {$B$};
\node[right] at (1.300,0.000) {$C$};
\end{tikzpicture}

== circ-def-cyclic-quad
ถาม: **บทนิยาม**
**รูปสี่เหลี่ยมแนบในวงกลม** คือ ?
ตอบ: รูปสี่เหลี่ยมที่อยู่ภายในวงกลม
โดย**จุดยอดทั้งสี่อยู่บนวงกลม**
(เรียกอีกชื่อว่า รูปสี่เหลี่ยมวงกลมล้อม)
รูปตอบ:
\begin{tikzpicture}[scale=1]
\draw[thick] (0,0) circle (1.3);
\draw[thick,blue] (-0.549,1.178) -- (-1.178,-0.549) -- (0.445,-1.222) -- (1.178,0.549) -- cycle;
\node[above left] at (-0.549,1.178) {$A$};
\node[below left] at (-1.178,-0.549) {$B$};
\node[below right] at (0.445,-1.222) {$C$};
\node[right] at (1.178,0.549) {$D$};
\end{tikzpicture}

== circ-def-chord
ถาม: **บทนิยาม**
**คอร์ด** คือ ?
ตอบ: ส่วนของเส้นตรงที่มี**จุดปลายทั้งสองอยู่บนวงกลม**เดียวกัน
เช่น $\overline{AB}$ และ $\overline{CD}$
คอร์ดที่ยาวที่สุดคือ **เส้นผ่านศูนย์กลาง** (เช่น $\overline{CD}$)
รูปตอบ:
\begin{tikzpicture}[scale=1]
\draw[thick] (0,0) circle (1.3);
\fill (0.000,0.000) circle (0.04);
\node[right] at (0.000,0.000) {$O$};
\draw[thick,blue] (-1.126,0.650) -- (0.996,0.836);
\draw[thick,red] (-0.445,-1.222) -- (0.445,1.222);
\node[left] at (-1.126,0.650) {$A$};
\node[right] at (0.996,0.836) {$B$};
\node[below] at (-0.445,-1.222) {$C$};
\node[above] at (0.445,1.222) {$D$};
\end{tikzpicture}

== circ-def-secant-tangent
ถาม: **บทนิยาม**
**เส้นตัดวงกลม** และ **เส้นสัมผัสวงกลม** ต่างกันอย่างไร ?
ตอบ: **เส้นตัด** = เส้นตรงที่ตัดวงกลม **2 จุด** (เส้น $\ell$)
**เส้นสัมผัส** = เส้นตรงที่ตัดวงกลม**เพียงจุดเดียว** (เส้น $m$)
เรียกจุดนั้นว่า **จุดสัมผัส** (จุด $P$)
รูปตอบ:
\begin{tikzpicture}[scale=1]
\draw[thick] (0,0) circle (1.3);
\fill (0.000,0.000) circle (0.04);
\node[below right] at (0.000,0.000) {$O$};
\draw[thick,blue,<->] (-2.2,0.05) -- (2.2,0.75);
\draw[thick,red,<->] (-2.2,-1.3) -- (2.2,-1.3);
\fill (0.000,-1.300) circle (0.04);
\node[blue] at (2.4,0.85) {$\ell$};
\node[red] at (2.4,-1.3) {$m$};
\node[below] at (0,-1.3) {$P$};
\end{tikzpicture}

# หัวข้อ: มุมที่จุดศูนย์กลางและส่วนโค้งที่รองรับมุม

== circ-central-to-arc
ถาม: ในวงกลมเดียวกัน (หรือวงกลมที่เท่ากันทุกประการ)
ถ้า**มุมที่จุดศูนย์กลาง**มีขนาดเท่ากัน
แล้วจะสรุปได้ว่า ?
ตอบ: **ส่วนโค้ง**ที่รองรับมุมที่จุดศูนย์กลางนั้น**ยาวเท่ากัน**
ถ้า $A\hat{O}B = C\hat{O}D$ แล้ว $\overset{\frown}{AB}$ ยาวเท่ากับ $\overset{\frown}{CD}$
รูปถาม:
\begin{tikzpicture}[scale=1]
\draw[thick] (0,0) circle (1.3);
\fill (0.000,0.000) circle (0.04);
\node[above left] at (0.000,0.000) {$O$};
\draw[thick,blue] (0.000,0.000) -- (-1.222,-0.445);
\draw[thick,blue] (0.000,0.000) -- (-0.226,-1.280);
\draw[thick,blue] (0.000,0.000) -- (1.280,-0.226);
\draw[thick,blue] (0.000,0.000) -- (0.836,0.996);
\node[left] at (-1.222,-0.445) {$A$};
\node[below] at (-0.226,-1.280) {$B$};
\node[right] at (1.280,-0.226) {$C$};
\node[above] at (0.836,0.996) {$D$};
\fill[orange,opacity=0.35] (0.000,0.000) -- ++(-160.0:0.35) arc (-160.0:-100.0:0.35) -- cycle;
\draw[orange] (0.000,0.000) ++(-160.0:0.35) arc (-160.0:-100.0:0.35);
\fill[orange,opacity=0.35] (0.000,0.000) -- ++(-10.0:0.35) arc (-10.0:50.0:0.35) -- cycle;
\draw[orange] (0.000,0.000) ++(-10.0:0.35) arc (-10.0:50.0:0.35);
\end{tikzpicture}

== circ-arc-to-central
ถาม: ในวงกลมเดียวกัน (หรือวงกลมที่เท่ากันทุกประการ)
ถ้า**ส่วนโค้ง**ยาวเท่ากัน
แล้วจะสรุปได้ว่า ?
ตอบ: **มุมที่จุดศูนย์กลาง**ที่รองรับด้วยส่วนโค้งนั้น**มีขนาดเท่ากัน**
ถ้า $\overset{\frown}{AB}$ ยาวเท่ากับ $\overset{\frown}{CD}$ แล้ว $A\hat{O}B = C\hat{O}D$
รูปถาม:
\begin{tikzpicture}[scale=1]
\draw[thick] (0,0) circle (1.3);
\fill (0.000,0.000) circle (0.04);
\node[above left] at (0.000,0.000) {$O$};
\draw[very thick,red] (-1.222,-0.445) arc (200.0:260.0:1.30);
\draw[very thick,red] (1.280,-0.226) arc (350.0:410.0:1.30);
\draw[thick,blue] (0.000,0.000) -- (-1.222,-0.445);
\draw[thick,blue] (0.000,0.000) -- (-0.226,-1.280);
\draw[thick,blue] (0.000,0.000) -- (1.280,-0.226);
\draw[thick,blue] (0.000,0.000) -- (0.836,0.996);
\node[left] at (-1.222,-0.445) {$A$};
\node[below] at (-0.226,-1.280) {$B$};
\node[right] at (1.280,-0.226) {$C$};
\node[above] at (0.836,0.996) {$D$};
\end{tikzpicture}

# หัวข้อ: มุมที่จุดศูนย์กลางและมุมในส่วนโค้งของวงกลม

== circ-central-double
ถาม: ในวงกลมเดียวกัน
มุมที่จุดศูนย์กลาง กับ มุมในส่วนโค้งของวงกลม
ที่รองรับด้วย**ส่วนโค้งเดียวกัน** สัมพันธ์กันอย่างไร ?
ตอบ: **มุมที่จุดศูนย์กลาง = 2 เท่า ของมุมในส่วนโค้ง**
$A\hat{O}C = 2(A\hat{B}C)$
รูปตอบ:
\begin{tikzpicture}[scale=1]
\draw[thick] (0,0) circle (1.3);
\fill (0,0) circle (0.04);
\draw[thick,blue] (210:1.3) -- (90:1.3) -- (330:1.3);
\draw[thick,red] (210:1.3) -- (0,0) -- (330:1.3);
\node[above] at (90:1.3) {$B$};
\node[below left] at (210:1.3) {$A$};
\node[below right] at (330:1.3) {$C$};
\node[above right] at (0,0) {$O$};
\node[blue] at (90:0.85) {$x^\circ$};
\node[red] at (270:0.35) {$2x^\circ$};
\end{tikzpicture}

== circ-inscribed-half
ถาม: ในวงกลมเดียวกัน
ถ้ามุมที่จุดศูนย์กลาง $A\hat{O}C$ มีขนาด $120^\circ$
มุมในส่วนโค้ง $A\hat{B}C$ ที่รองรับด้วยส่วนโค้งเดียวกันมีขนาดเท่าใด ?
ตอบ: $A\hat{B}C = 60^\circ$
มุมในส่วนโค้ง = **ครึ่งหนึ่ง**ของมุมที่จุดศูนย์กลางที่รองรับด้วยส่วนโค้งเดียวกัน
รูปถาม:
\begin{tikzpicture}[scale=1]
\draw[thick] (0,0) circle (1.3);
\fill (0.000,0.000) circle (0.04);
\node[above right] at (0.000,0.000) {$O$};
\draw[thick,blue] (-1.126,-0.650) -- (0.000,1.300);
\draw[thick,blue] (0.000,1.300) -- (1.126,-0.650);
\draw[thick,red] (-1.126,-0.650) -- (0.000,0.000);
\draw[thick,red] (0.000,0.000) -- (1.126,-0.650);
\fill[red,opacity=0.35] (0.000,0.000) -- ++(-150.0:0.30) arc (-150.0:-30.0:0.30) -- cycle;
\draw[red] (0.000,0.000) ++(-150.0:0.30) arc (-150.0:-30.0:0.30);
\node[red] at (-0.000,-0.500) {$120^\circ$};
\fill[blue,opacity=0.35] (0.000,1.300) -- ++(-120.0:0.35) arc (-120.0:-60.0:0.35) -- cycle;
\draw[blue] (0.000,1.300) ++(-120.0:0.35) arc (-120.0:-60.0:0.35);
\node[blue] at (0.000,0.700) {$?$};
\node[below left] at (-1.126,-0.650) {$A$};
\node[above] at (0.000,1.300) {$B$};
\node[below right] at (1.126,-0.650) {$C$};
\end{tikzpicture}

# หัวข้อ: มุมในส่วนโค้งของวงกลมและส่วนโค้งที่รองรับมุม

== circ-inscribed-same-arc
ถาม: ในวงกลมเดียวกัน
ถ้ามุมในส่วนโค้งของวงกลมรองรับด้วย**ส่วนโค้งเดียวกัน**
แล้วจะสรุปได้ว่า ?
ตอบ: มุมเหล่านั้น**มีขนาดเท่ากัน**
$A\hat{P}C = A\hat{Q}C$
(เพราะต่างก็เป็นครึ่งหนึ่งของมุมที่จุดศูนย์กลางมุมเดียวกัน)
รูปถาม:
\begin{tikzpicture}[scale=1]
\draw[thick] (0,0) circle (1.3);
\draw[very thick,red] (-0.919,-0.919) arc (225.0:315.0:1.30);
\draw[thick,blue] (-0.919,-0.919) -- (0.650,1.126);
\draw[thick,blue] (0.650,1.126) -- (0.919,-0.919);
\draw[thick,blue] (-0.919,-0.919) -- (-0.996,0.836);
\draw[thick,blue] (-0.996,0.836) -- (0.919,-0.919);
\fill[orange,opacity=0.35] (0.650,1.126) -- ++(-127.5:0.35) arc (-127.5:-82.5:0.35) -- cycle;
\draw[orange] (0.650,1.126) ++(-127.5:0.35) arc (-127.5:-82.5:0.35);
\fill[orange,opacity=0.35] (-0.996,0.836) -- ++(-87.5:0.35) arc (-87.5:-42.5:0.35) -- cycle;
\draw[orange] (-0.996,0.836) ++(-87.5:0.35) arc (-87.5:-42.5:0.35);
\node[below left] at (-0.919,-0.919) {$A$};
\node[below right] at (0.919,-0.919) {$C$};
\node[above right] at (0.650,1.126) {$P$};
\node[above left] at (-0.996,0.836) {$Q$};
\end{tikzpicture}

== circ-inscribed-to-arc
ถาม: ในวงกลมเดียวกัน (หรือวงกลมที่เท่ากันทุกประการ)
ถ้า**มุมในส่วนโค้งของวงกลม**มีขนาดเท่ากัน
แล้วจะสรุปได้ว่า ?
ตอบ: **ส่วนโค้ง**ที่รองรับมุมเหล่านั้น**ยาวเท่ากัน**
ถ้า $A\hat{P}B = C\hat{Q}D$ แล้ว $\overset{\frown}{AB}$ ยาวเท่ากับ $\overset{\frown}{CD}$
รูปถาม:
\begin{tikzpicture}[scale=1]
\draw[thick] (0,0) circle (1.3);
\draw[thick,blue] (0.226,1.280) -- (0.549,-1.178);
\draw[thick,blue] (0.226,1.280) -- (1.280,-0.226);
\draw[thick,blue] (-0.836,0.996) -- (-1.280,-0.226);
\draw[thick,blue] (-0.836,0.996) -- (-0.549,-1.178);
\node[left] at (-1.280,-0.226) {$A$};
\node[below] at (-0.549,-1.178) {$B$};
\node[below] at (0.549,-1.178) {$C$};
\node[right] at (1.280,-0.226) {$D$};
\node[above left] at (-0.836,0.996) {$P$};
\node[above right] at (0.226,1.280) {$Q$};
\fill[orange,opacity=0.35] (-0.836,0.996) -- ++(-110.0:0.60) arc (-110.0:-82.5:0.60) -- cycle;
\draw[orange] (-0.836,0.996) ++(-110.0:0.60) arc (-110.0:-82.5:0.60);
\fill[orange,opacity=0.35] (0.226,1.280) -- ++(-82.5:0.60) arc (-82.5:-55.0:0.60) -- cycle;
\draw[orange] (0.226,1.280) ++(-82.5:0.60) arc (-82.5:-55.0:0.60);
\end{tikzpicture}

== circ-arc-to-inscribed
ถาม: ในวงกลมเดียวกัน (หรือวงกลมที่เท่ากันทุกประการ)
ถ้า**ส่วนโค้ง**ยาวเท่ากัน
แล้วจะสรุปได้ว่า ?
ตอบ: **มุมในส่วนโค้งของวงกลม**ที่รองรับด้วยส่วนโค้งเหล่านั้น**มีขนาดเท่ากัน**
ถ้า $\overset{\frown}{AB}$ ยาวเท่ากับ $\overset{\frown}{CD}$ แล้ว $A\hat{P}B = C\hat{Q}D$
รูปถาม:
\begin{tikzpicture}[scale=1]
\draw[thick] (0,0) circle (1.3);
\draw[very thick,red] (-1.280,-0.226) arc (190.0:245.0:1.30);
\draw[very thick,red] (0.549,-1.178) arc (295.0:350.0:1.30);
\draw[thick,blue] (0.226,1.280) -- (0.549,-1.178);
\draw[thick,blue] (0.226,1.280) -- (1.280,-0.226);
\draw[thick,blue] (-0.836,0.996) -- (-1.280,-0.226);
\draw[thick,blue] (-0.836,0.996) -- (-0.549,-1.178);
\node[left] at (-1.280,-0.226) {$A$};
\node[below] at (-0.549,-1.178) {$B$};
\node[below] at (0.549,-1.178) {$C$};
\node[right] at (1.280,-0.226) {$D$};
\node[above left] at (-0.836,0.996) {$P$};
\node[above right] at (0.226,1.280) {$Q$};
\end{tikzpicture}

# หัวข้อ: มุมในครึ่งวงกลม

== circ-semicircle-90
ถาม: ถ้า $\overline{AC}$ เป็นเส้นผ่านศูนย์กลาง และ $B$ อยู่บนวงกลม
แล้วจะสรุปได้ว่า ?
ตอบ: $A\hat{B}C = 90^\circ$
**มุมในครึ่งวงกลมมีขนาด 90 องศา** (หนึ่งมุมฉาก)
เรียกว่า ทฤษฎีบทของทาเลส
รูปถาม:
\begin{tikzpicture}[scale=1]
\draw[thick] (0,0) circle (1.3);
\fill (0,0) circle (0.04);
\draw[thick,blue] (180:1.3) -- (0:1.3);
\draw[thick] (180:1.3) -- (60:1.3) -- (0:1.3);
\node[left] at (180:1.3) {$A$};
\node[above right] at (60:1.3) {$B$};
\node[right] at (0:1.3) {$C$};
\node[below] at (0,0) {$O$};
\end{tikzpicture}

// นอกหนังสือ: บทกลับของมุมในครึ่งวงกลม (เป็นจริง แต่หนังสือไม่ได้เขียนเป็นทฤษฎีบท)
== circ-90-semicircle
ถาม: ถ้า $A, B, C$ อยู่บนวงกลม และ $A\hat{B}C = 90^\circ$
แล้วจะสรุปได้ว่า ?
ตอบ: $\overline{AC}$ เป็น**เส้นผ่านศูนย์กลาง**ของวงกลม
(เพราะมุมที่จุดศูนย์กลาง $A\hat{O}C = 2 \times 90^\circ = 180^\circ$ เป็นมุมตรง)
รูปถาม:
\begin{tikzpicture}[scale=1]
\draw[thick] (0,0) circle (1.3);
\draw[thick,blue] (-1.222,-0.445) -- (-0.445,1.222);
\draw[thick,blue] (-0.445,1.222) -- (1.222,0.445);
\draw (-0.516,1.068) -- (-0.362,0.996) -- (-0.291,1.150);
\node[left] at (-1.222,-0.445) {$A$};
\node[above] at (-0.445,1.222) {$B$};
\node[right] at (1.222,0.445) {$C$};
\end{tikzpicture}

# หัวข้อ: รูปสี่เหลี่ยมแนบในวงกลม

== circ-cyclic-to-180
ถาม: ถ้า $\square ABCD$ เป็นรูปสี่เหลี่ยม**แนบในวงกลม**
แล้วจะสรุปได้ว่า ?
ตอบ: **มุมตรงข้ามรวมกันได้ $180^\circ$** (สองมุมฉาก)
$\hat{A} + \hat{C} = 180^\circ$ และ $\hat{B} + \hat{D} = 180^\circ$
รูปถาม:
\begin{tikzpicture}[scale=1]
\draw[thick] (0,0) circle (1.3);
\draw[thick,blue] (115:1.3) -- (205:1.3) -- (290:1.3) -- (25:1.3) -- cycle;
\node[above left] at (115:1.3) {$A$};
\node[below left] at (205:1.3) {$B$};
\node[below right] at (290:1.3) {$C$};
\node[right] at (25:1.3) {$D$};
\end{tikzpicture}

// หนังสือเกริ่นไว้ในบทสนทนา (หน้า 68) แต่ไม่ได้เขียนเป็นกรอบทฤษฎีบท
== circ-180-to-cyclic
ถาม: ถ้ารูปสี่เหลี่ยม $ABCD$ มี**มุมตรงข้ามรวมกันได้ $180^\circ$**
แล้วจะสรุปได้ว่า ?
ตอบ: $\square ABCD$ เป็น**รูปสี่เหลี่ยมแนบในวงกลม**
(สร้างวงกลมผ่านจุดยอดทั้งสี่ได้)
รูปถาม:
\begin{tikzpicture}[scale=1]
\draw[thick,blue] (-0.549,1.178) -- (-1.178,-0.549) -- (0.445,-1.222) -- (1.178,0.549) -- cycle;
\fill[orange,opacity=0.35] (-0.549,1.178) -- ++(-110.0:0.35) arc (-110.0:-20.0:0.35) -- cycle;
\draw[orange] (-0.549,1.178) ++(-110.0:0.35) arc (-110.0:-20.0:0.35);
\node[orange] at (-0.275,0.589) {$x^\circ$};
\fill[red,opacity=0.35] (0.445,-1.222) -- ++(67.5:0.35) arc (67.5:157.5:0.35) -- cycle;
\draw[red] (0.445,-1.222) ++(67.5:0.35) arc (67.5:157.5:0.35);
\node[red] at (0.081,-0.344) {$180^\circ-x^\circ$};
\node[above left] at (-0.549,1.178) {$A$};
\node[below left] at (-1.178,-0.549) {$B$};
\node[below right] at (0.445,-1.222) {$C$};
\node[right] at (1.178,0.549) {$D$};
\end{tikzpicture}
รูปตอบ:
\begin{tikzpicture}[scale=1]
\draw[thick] (0,0) circle (1.3);
\draw[thick,blue] (-0.549,1.178) -- (-1.178,-0.549) -- (0.445,-1.222) -- (1.178,0.549) -- cycle;
\node[above left] at (-0.549,1.178) {$A$};
\node[below left] at (-1.178,-0.549) {$B$};
\node[below right] at (0.445,-1.222) {$C$};
\node[right] at (1.178,0.549) {$D$};
\end{tikzpicture}

== circ-cyclic-exterior
ถาม: ถ้า $\square ABCD$ แนบในวงกลม และต่อ $\overline{BC}$ ออกไปถึง $E$
แล้วจะสรุปได้ว่า มุมภายนอก $D\hat{C}E$ เท่ากับมุมใด ?
ตอบ: $D\hat{C}E = B\hat{A}D$
**มุมภายนอก = มุมภายในที่อยู่ตรงข้าม**
เพราะ $D\hat{C}E + B\hat{C}D = 180^\circ$ และ $B\hat{A}D + B\hat{C}D = 180^\circ$
รูปถาม:
\begin{tikzpicture}[scale=1]
\draw[thick] (0,0) circle (1.3);
\draw[thick,blue] (-0.549,1.178) -- (-1.178,-0.549) -- (0.445,-1.222) -- (1.178,0.549) -- cycle;
\draw[thick,blue,dashed] (0.445,-1.222) -- (1.743,-1.759);
\fill[red,opacity=0.35] (0.445,-1.222) -- ++(-22.5:0.35) arc (-22.5:67.5:0.35) -- cycle;
\draw[red] (0.445,-1.222) ++(-22.5:0.35) arc (-22.5:67.5:0.35);
\fill[orange,opacity=0.35] (-0.549,1.178) -- ++(-110.0:0.35) arc (-110.0:-20.0:0.35) -- cycle;
\draw[orange] (-0.549,1.178) ++(-110.0:0.35) arc (-110.0:-20.0:0.35);
\node[above left] at (-0.549,1.178) {$A$};
\node[below left] at (-1.178,-0.549) {$B$};
\node[below right] at (0.445,-1.222) {$C$};
\node[right] at (1.178,0.549) {$D$};
\node[right] at (1.743,-1.759) {$E$};
\end{tikzpicture}

// นอกหนังสือ: บทกลับของมุมภายนอกรูปสี่เหลี่ยมแนบในวงกลม
== circ-exterior-to-cyclic
ถาม: ถ้ารูปสี่เหลี่ยม $ABCD$ มี**มุมภายนอก**ที่จุดยอดหนึ่ง
เท่ากับ**มุมภายในที่อยู่ตรงข้าม**
แล้วจะสรุปได้ว่า ?
ตอบ: $\square ABCD$ เป็น**รูปสี่เหลี่ยมแนบในวงกลม**
(เพราะได้มุมตรงข้ามรวมกันเป็น $180^\circ$)
รูปถาม:
\begin{tikzpicture}[scale=1]
\draw[thick,blue] (-0.549,1.178) -- (-1.178,-0.549) -- (0.445,-1.222) -- (1.178,0.549) -- cycle;
\draw[thick,blue,dashed] (0.445,-1.222) -- (1.743,-1.759);
\fill[red,opacity=0.35] (0.445,-1.222) -- ++(-22.5:0.35) arc (-22.5:67.5:0.35) -- cycle;
\draw[red] (0.445,-1.222) ++(-22.5:0.35) arc (-22.5:67.5:0.35);
\node[red] at (1.045,-0.973) {$x^\circ$};
\fill[red,opacity=0.35] (-0.549,1.178) -- ++(-110.0:0.35) arc (-110.0:-20.0:0.35) -- cycle;
\draw[red] (-0.549,1.178) ++(-110.0:0.35) arc (-110.0:-20.0:0.35);
\node[red] at (-0.275,0.589) {$x^\circ$};
\node[above left] at (-0.549,1.178) {$A$};
\node[below left] at (-1.178,-0.549) {$B$};
\node[below right] at (0.445,-1.222) {$C$};
\node[right] at (1.178,0.549) {$D$};
\node[right] at (1.743,-1.759) {$E$};
\end{tikzpicture}

# หัวข้อ: คอร์ดและส่วนโค้งของวงกลม

== circ-chord-to-arc
ถาม: ในวงกลมเดียวกัน (หรือวงกลมที่เท่ากันทุกประการ)
ถ้า**คอร์ดสองเส้นยาวเท่ากัน**
แล้วจะสรุปได้ว่า ?
ตอบ: คอร์ดทั้งสองตัดวงกลม ทำให้
**ส่วนโค้งน้อยยาวเท่ากัน** และ **ส่วนโค้งใหญ่ยาวเท่ากัน**
รูปถาม:
\begin{tikzpicture}[scale=1]
\draw[thick] (0,0) circle (1.3);
\fill (0.000,0.000) circle (0.04);
\node[above right] at (0.000,0.000) {$O$};
\draw[thick,blue] (-0.226,1.280) -- (-1.222,0.445);
\draw[thick,blue] (0.226,-1.280) -- (1.222,-0.445);
\draw (-0.788,0.939) -- (-0.659,0.786);
\draw (0.788,-0.939) -- (0.659,-0.786);
\node[above] at (-0.226,1.280) {$A$};
\node[left] at (-1.222,0.445) {$B$};
\node[below] at (0.226,-1.280) {$C$};
\node[right] at (1.222,-0.445) {$D$};
\end{tikzpicture}
รูปตอบ:
\begin{tikzpicture}[scale=1]
\draw[thick] (0,0) circle (1.3);
\fill (0.000,0.000) circle (0.04);
\node[above right] at (0.000,0.000) {$O$};
\draw[very thick,red] (-0.226,1.280) arc (100.0:160.0:1.30);
\draw[very thick,red] (0.226,-1.280) arc (280.0:340.0:1.30);
\draw[thick,blue] (-0.226,1.280) -- (-1.222,0.445);
\draw[thick,blue] (0.226,-1.280) -- (1.222,-0.445);
\node[above] at (-0.226,1.280) {$A$};
\node[left] at (-1.222,0.445) {$B$};
\node[below] at (0.226,-1.280) {$C$};
\node[right] at (1.222,-0.445) {$D$};
\end{tikzpicture}

== circ-arc-to-chord
ถาม: ในวงกลมเดียวกัน (หรือวงกลมที่เท่ากันทุกประการ)
ถ้าคอร์ดสองเส้นตัดวงกลม ทำให้**ส่วนโค้งน้อยยาวเท่ากัน**
แล้วจะสรุปได้ว่า ?
ตอบ: **คอร์ดทั้งสองยาวเท่ากัน**
$AB = CD$
รูปถาม:
\begin{tikzpicture}[scale=1]
\draw[thick] (0,0) circle (1.3);
\fill (0.000,0.000) circle (0.04);
\node[above right] at (0.000,0.000) {$O$};
\draw[very thick,red] (-0.226,1.280) arc (100.0:160.0:1.30);
\draw[very thick,red] (0.226,-1.280) arc (280.0:340.0:1.30);
\draw[thick,blue] (-0.226,1.280) -- (-1.222,0.445);
\draw[thick,blue] (0.226,-1.280) -- (1.222,-0.445);
\node[above] at (-0.226,1.280) {$A$};
\node[left] at (-1.222,0.445) {$B$};
\node[below] at (0.226,-1.280) {$C$};
\node[right] at (1.222,-0.445) {$D$};
\end{tikzpicture}

# หัวข้อ: คอร์ดและจุดศูนย์กลางของวงกลม

== circ-bisect-to-perp
ถาม: ถ้าส่วนของเส้นตรงที่**ผ่านจุดศูนย์กลาง**
**แบ่งครึ่ง**คอร์ด (ที่ไม่ใช่เส้นผ่านศูนย์กลาง)
แล้วจะสรุปได้ว่า ?
ตอบ: ส่วนของเส้นตรงนั้น**ตั้งฉาก**กับคอร์ด
$\overline{OM} \perp \overline{AB}$
รูปถาม:
\begin{tikzpicture}[scale=1]
\draw[thick] (0,0) circle (1.3);
\fill (0.000,0.000) circle (0.04);
\node[above] at (0.000,0.000) {$O$};
\draw[thick,blue] (-1.222,-0.445) -- (1.222,-0.445);
\node[below left] at (-1.222,-0.445) {$A$};
\node[below right] at (1.222,-0.445) {$B$};
\draw[thick,red] (0.000,0.000) -- (0.000,-0.445);
\draw (-0.611,-0.545) -- (-0.611,-0.345);
\draw (0.611,-0.545) -- (0.611,-0.345);
\node[below] at (0.000,-0.445) {$M$};
\end{tikzpicture}
รูปตอบ:
\begin{tikzpicture}[scale=1]
\draw[thick] (0,0) circle (1.3);
\fill (0,0) circle (0.04);
\draw[thick,blue] (200:1.3) -- (340:1.3);
\draw[thick,red] (0,0) -- (0,-1.3);
\draw (0,-0.445) -- (0.15,-0.445) -- (0.15,-0.295);
\node[above] at (0,0) {$O$};
\node[below left] at (200:1.3) {$A$};
\node[below right] at (340:1.3) {$B$};
\node[below left] at (0,-0.445) {$M$};
\end{tikzpicture}

== circ-perp-to-bisect
ถาม: ถ้าส่วนของเส้นตรงที่**ผ่านจุดศูนย์กลาง**
**ตั้งฉาก**กับคอร์ด (ที่ไม่ใช่เส้นผ่านศูนย์กลาง)
แล้วจะสรุปได้ว่า ?
ตอบ: ส่วนของเส้นตรงนั้น**แบ่งครึ่ง**คอร์ด
$AM = MB$
รูปถาม:
\begin{tikzpicture}[scale=1]
\draw[thick] (0,0) circle (1.3);
\fill (0.000,0.000) circle (0.04);
\node[above] at (0.000,0.000) {$O$};
\draw[thick,blue] (-1.222,-0.445) -- (1.222,-0.445);
\node[below left] at (-1.222,-0.445) {$A$};
\node[below right] at (1.222,-0.445) {$B$};
\draw[thick,red] (0.000,0.000) -- (0.000,-0.445);
\draw (0.000,-0.275) -- (0.170,-0.275) -- (0.170,-0.445);
\node[below left] at (0.000,-0.445) {$M$};
\end{tikzpicture}

== circ-perp-bisector-center
ถาม: ถ้าเส้นตรงเส้นหนึ่ง**ตั้งฉากและแบ่งครึ่ง**คอร์ดของวงกลม
แล้วจะสรุปได้ว่า ?
ตอบ: เส้นตรงนั้น**ผ่านจุดศูนย์กลาง**ของวงกลม
รูปตอบ:
\begin{tikzpicture}[scale=1]
\draw[thick] (0,0) circle (1.3);
\fill (0.000,0.000) circle (0.04);
\node[above right] at (0.000,0.000) {$O$};
\draw[thick,blue] (-1.222,-0.445) -- (1.222,-0.445);
\node[below left] at (-1.222,-0.445) {$A$};
\node[below right] at (1.222,-0.445) {$B$};
\draw[thick,red,<->] (0,-1.75) -- (0,1.75);
\draw (0.000,-0.275) -- (0.170,-0.275) -- (0.170,-0.445);
\draw (-0.611,-0.545) -- (-0.611,-0.345);
\draw (0.611,-0.545) -- (0.611,-0.345);
\end{tikzpicture}

== circ-find-center
ถาม: กำหนดวงกลมมาให้ แต่ไม่รู้จุดศูนย์กลาง
จะหา**จุดศูนย์กลาง**ได้อย่างไร ?
ตอบ: ลากคอร์ด 2 เส้นที่**ไม่ขนานกัน**
สร้างเส้นที่**แบ่งครึ่งและตั้งฉาก**กับคอร์ดแต่ละเส้น
**จุดตัด**ของสองเส้นนั้นคือจุดศูนย์กลาง
รูปตอบ:
\begin{tikzpicture}[scale=1]
\draw[thick] (0,0) circle (1.3);
\fill (0.000,0.000) circle (0.04);
\node[above] at (0.000,0.000) {$O$};
\draw[thick,blue] (-0.996,0.836) -- (-0.445,-1.222);
\draw[thick,blue] (0.650,-1.126) -- (1.126,0.650);
\draw (-0.817,-0.219) -- (-0.624,-0.167);
\draw (0.975,-0.298) -- (0.782,-0.246);
\draw (0.994,-0.230) -- (0.800,-0.178);
\draw[thick,red,<->] (-1.107,-0.297) -- (0.580,0.155);
\draw[thick,red,<->] (1.274,-0.341) -- (-0.580,0.155);
\node[above left] at (-0.996,0.836) {$A$};
\node[below] at (-0.445,-1.222) {$B$};
\node[below right] at (0.650,-1.126) {$C$};
\node[right] at (1.126,0.650) {$D$};
\end{tikzpicture}

# หัวข้อ: คอร์ดที่ยาวเท่ากัน

== circ-equal-chord-to-dist
ถาม: ในวงกลมเดียวกัน
ถ้า**คอร์ดสองเส้นยาวเท่ากัน**
แล้วจะสรุปได้ว่า ?
ตอบ: คอร์ดทั้งสอง**อยู่ห่างจากจุดศูนย์กลางเป็นระยะเท่ากัน**
$OM = ON$
รูปถาม:
\begin{tikzpicture}[scale=1]
\draw[thick] (0,0) circle (1.3);
\fill (0.000,0.000) circle (0.04);
\node[below left] at (0.000,0.000) {$O$};
\draw[thick,blue] (-0.445,1.222) -- (-1.222,-0.445);
\draw[thick,blue] (0.445,-1.222) -- (1.222,0.445);
\node[above] at (-0.445,1.222) {$A$};
\node[left] at (-1.222,-0.445) {$B$};
\node[below] at (0.445,-1.222) {$C$};
\node[right] at (1.222,0.445) {$D$};
\draw (-0.909,0.462) -- (-0.728,0.378);
\draw (-0.939,0.399) -- (-0.757,0.315);
\draw (0.909,-0.462) -- (0.728,-0.378);
\draw (0.939,-0.399) -- (0.757,-0.315);
\end{tikzpicture}
รูปตอบ:
\begin{tikzpicture}[scale=1]
\draw[thick] (0,0) circle (1.3);
\fill (0.000,0.000) circle (0.04);
\node[below left] at (0.000,0.000) {$O$};
\draw[thick,blue] (-0.445,1.222) -- (-1.222,-0.445);
\draw[thick,blue] (0.445,-1.222) -- (1.222,0.445);
\node[above] at (-0.445,1.222) {$A$};
\node[left] at (-1.222,-0.445) {$B$};
\node[below] at (0.445,-1.222) {$C$};
\node[right] at (1.222,0.445) {$D$};
\draw (-0.909,0.462) -- (-0.728,0.378);
\draw (-0.939,0.399) -- (-0.757,0.315);
\draw (0.909,-0.462) -- (0.728,-0.378);
\draw (0.939,-0.399) -- (0.757,-0.315);
\draw[thick,red] (0.000,0.000) -- (-0.833,0.388);
\draw[thick,red] (0.000,0.000) -- (0.833,-0.388);
\draw (-0.679,0.317) -- (-0.751,0.163) -- (-0.905,0.234);
\draw (0.679,-0.317) -- (0.751,-0.163) -- (0.905,-0.234);
\node[above left] at (-0.833,0.388) {$M$};
\node[below right] at (0.833,-0.388) {$N$};
\end{tikzpicture}

== circ-equal-dist-to-chord
ถาม: ในวงกลมเดียวกัน
ถ้าคอร์ดสองเส้น**อยู่ห่างจากจุดศูนย์กลางเป็นระยะเท่ากัน**
แล้วจะสรุปได้ว่า ?
ตอบ: **คอร์ดทั้งสองยาวเท่ากัน**
$AB = CD$
รูปถาม:
\begin{tikzpicture}[scale=1]
\draw[thick] (0,0) circle (1.3);
\fill (0.000,0.000) circle (0.04);
\node[below left] at (0.000,0.000) {$O$};
\draw[thick,blue] (-0.445,1.222) -- (-1.222,-0.445);
\draw[thick,blue] (0.445,-1.222) -- (1.222,0.445);
\node[above] at (-0.445,1.222) {$A$};
\node[left] at (-1.222,-0.445) {$B$};
\node[below] at (0.445,-1.222) {$C$};
\node[right] at (1.222,0.445) {$D$};
\draw[thick,red] (0.000,0.000) -- (-0.833,0.388);
\draw[thick,red] (0.000,0.000) -- (0.833,-0.388);
\draw (-0.374,0.285) -- (-0.459,0.104);
\draw (0.374,-0.285) -- (0.459,-0.104);
\draw (-0.679,0.317) -- (-0.751,0.163) -- (-0.905,0.234);
\draw (0.679,-0.317) -- (0.751,-0.163) -- (0.905,-0.234);
\node[above left] at (-0.833,0.388) {$M$};
\node[below right] at (0.833,-0.388) {$N$};
\end{tikzpicture}

# หัวข้อ: เส้นสัมผัสวงกลมและรัศมี

== circ-tangent-to-perp
ถาม: ถ้า $\overleftrightarrow{AB}$ **สัมผัส**วงกลม $O$ ที่จุด $P$
แล้วจะสรุปได้ว่า ?
ตอบ: $\overleftrightarrow{AB} \perp \overline{OP}$
**เส้นสัมผัสตั้งฉากกับรัศมีที่จุดสัมผัส**
รูปตอบ:
\begin{tikzpicture}[scale=1]
\draw[thick] (0,0) circle (1.3);
\fill (0.000,0.000) circle (0.04);
\node[above] at (0.000,0.000) {$O$};
\draw[thick,blue,<->] (-2,-1.3) -- (2,-1.3);
\draw[thick,red] (0.000,0.000) -- (0.000,-1.300);
\draw (0.000,-1.130) -- (0.170,-1.130) -- (0.170,-1.300);
\node[below] at (0.000,-1.300) {$P$};
\node[below] at (-1.7,-1.3) {$A$};
\node[below] at (1.7,-1.3) {$B$};
\end{tikzpicture}

== circ-perp-to-tangent
ถาม: ถ้าเส้นตรงเส้นหนึ่ง**ตั้งฉากกับรัศมี**ของวงกลม
ที่**จุดปลายบนวงกลม**
แล้วจะสรุปได้ว่า ?
ตอบ: เส้นตรงนั้นเป็น**เส้นสัมผัสวงกลม**ที่จุดนั้น
รูปถาม:
\begin{tikzpicture}[scale=1]
\draw[thick] (0,0) circle (1.3);
\fill (0.000,0.000) circle (0.04);
\node[above] at (0.000,0.000) {$O$};
\draw[thick,blue,<->] (-2,-1.3) -- (2,-1.3);
\draw[thick,red] (0.000,0.000) -- (0.000,-1.300);
\draw (0.000,-1.130) -- (0.170,-1.130) -- (0.170,-1.300);
\node[below] at (0.000,-1.300) {$P$};
\node[below] at (-1.7,-1.3) {$A$};
\node[below] at (1.7,-1.3) {$B$};
\end{tikzpicture}

# หัวข้อ: เส้นสัมผัสจากจุดภายนอกวงกลม

== circ-two-tangents-equal
ถาม: ถ้า $\overline{PA}$ และ $\overline{PB}$ ลากจากจุด $P$ ภายนอกวงกลม
มาสัมผัสวงกลมที่ $A$ และ $B$
แล้วจะสรุปได้ว่า ?
ตอบ: $PA = PB$
**ส่วนของเส้นสัมผัส 2 เส้นที่ลากจากจุดภายนอกเดียวกัน ยาวเท่ากัน**
รูปถาม:
\begin{tikzpicture}[scale=1]
\draw[thick] (0,0) circle (1.3);
\fill (0,0) circle (0.04);
\draw[thick,blue] (3,0) -- (0.564,1.171);
\draw[thick,blue] (3,0) -- (0.564,-1.171);
\node[left] at (0,0) {$O$};
\node[right] at (3,0) {$P$};
\node[above] at (0.564,1.171) {$A$};
\node[below] at (0.564,-1.171) {$B$};
\end{tikzpicture}

// จากชวนคิด 2.8 (หนังสือไม่ได้เขียนเป็นกรอบทฤษฎีบท)
== circ-two-tangents-angle
ถาม: ถ้า $\overline{PA}$ และ $\overline{PB}$ สัมผัสวงกลม $O$ ที่ $A$ และ $B$
แล้วจะสรุปได้ว่า $A\hat{P}O$ กับ $B\hat{P}O$ สัมพันธ์กันอย่างไร ?
ตอบ: $A\hat{P}O = B\hat{P}O$
($\overline{PO}$ แบ่งครึ่ง $A\hat{P}B$)
เพราะ $\triangle PAO \cong \triangle PBO$ แบบ ฉ.ด.ด.
รูปถาม:
\begin{tikzpicture}[scale=1]
\draw[thick] (0,0) circle (1.3);
\fill (0.000,0.000) circle (0.04);
\node[left] at (0.000,0.000) {$O$};
\draw[thick,blue] (3.000,0.000) -- (0.564,1.171);
\draw[thick,blue] (3.000,0.000) -- (0.564,-1.171);
\draw[thick] (0.000,0.000) -- (0.564,1.171);
\draw[thick] (0.000,0.000) -- (0.564,-1.171);
\draw[thick,red] (0.000,0.000) -- (3.000,0.000);
\draw (0.490,1.018) -- (0.643,0.944) -- (0.717,1.097);
\draw (0.490,-1.018) -- (0.643,-0.944) -- (0.717,-1.097);
\fill[orange,opacity=0.35] (3.000,0.000) -- ++(154.3:0.60) arc (154.3:180.0:0.60) -- cycle;
\draw[orange] (3.000,0.000) ++(154.3:0.60) arc (154.3:180.0:0.60);
\fill[purple,opacity=0.35] (3.000,0.000) -- ++(180.0:0.70) arc (180.0:205.7:0.70) -- cycle;
\draw[purple] (3.000,0.000) ++(180.0:0.70) arc (180.0:205.7:0.70);
\node[right] at (3.000,0.000) {$P$};
\node[above] at (0.564,1.171) {$A$};
\node[below] at (0.564,-1.171) {$B$};
\end{tikzpicture}

# หัวข้อ: เส้นสัมผัสวงกลมและคอร์ดของวงกลม

== circ-def-tangent-chord-angle
ถาม: $\overleftrightarrow{AB}$ สัมผัสวงกลมที่ $P$ และ $\overline{PQ}$ เป็นคอร์ด
$A\hat{P}Q$ (สีส้ม) เรียกว่ามุมอะไร ?
และ $P\hat{R}Q$ (สีม่วง) เรียกว่ามุมอะไร ?
ตอบ: $A\hat{P}Q$ = **มุมที่เกิดจากคอร์ดและเส้นสัมผัสที่จุดสัมผัส** $P$
$P\hat{R}Q$ = **มุมในส่วนโค้งของวงกลมที่อยู่ตรงข้ามกับคอร์ด** $PQ$
(อยู่**คนละข้าง**ของคอร์ดกับ $A\hat{P}Q$)
รูปถาม:
\begin{tikzpicture}[scale=1]
\draw[thick] (0,0) circle (1.3);
\draw[thick,blue,<->] (-2,-1.3) -- (2,-1.3);
\node[below] at (0.000,-1.300) {$P$};
\node[below] at (-1.7,-1.3) {$A$};
\node[below] at (1.7,-1.3) {$B$};
\node[left] at (-1.126,0.650) {$Q$};
\draw[thick,red] (0.000,-1.300) -- (-1.126,0.650);
\fill[orange,opacity=0.35] (0.000,-1.300) -- ++(120.0:0.40) arc (120.0:180.0:0.40) -- cycle;
\draw[orange] (0.000,-1.300) ++(120.0:0.40) arc (120.0:180.0:0.40);
\draw[thick] (0.000,-1.300) -- (0.836,0.996);
\draw[thick] (0.836,0.996) -- (-1.126,0.650);
\fill[purple,opacity=0.35] (0.836,0.996) -- ++(-170.0:0.35) arc (-170.0:-110.0:0.35) -- cycle;
\draw[purple] (0.836,0.996) ++(-170.0:0.35) arc (-170.0:-110.0:0.35);
\node[above right] at (0.836,0.996) {$R$};
\end{tikzpicture}

== circ-tangent-chord-angle
ถาม: ถ้า $\overleftrightarrow{AB}$ สัมผัสวงกลมที่ $P$, $\overline{PQ}$ เป็นคอร์ด
และ $R$ อยู่บนวงกลมคนละข้างกับ $A\hat{P}Q$
แล้วจะสรุปได้ว่า ?
ตอบ: $A\hat{P}Q = P\hat{R}Q$
**มุมที่เกิดจากคอร์ดและเส้นสัมผัส = มุมในส่วนโค้งที่อยู่ตรงข้ามกับคอร์ดนั้น**
รูปถาม:
\begin{tikzpicture}[scale=1]
\draw[thick] (0,0) circle (1.3);
\draw[thick,blue,<->] (-2,-1.3) -- (2,-1.3);
\draw[thick,red] (0,-1.3) -- (150:1.3);
\draw[thick] (0,-1.3) -- (50:1.3) -- (150:1.3);
\node[below] at (0,-1.3) {$P$};
\node[below] at (-1.7,-1.3) {$A$};
\node[below] at (1.7,-1.3) {$B$};
\node[left] at (150:1.3) {$Q$};
\node[above right] at (50:1.3) {$R$};
\end{tikzpicture}

// นอกหนังสือ: บทกลับของมุมระหว่างคอร์ดกับเส้นสัมผัส
== circ-chord-angle-to-tangent
ถาม: ถ้า $\overline{PQ}$ เป็นคอร์ด เส้นตรง $\overleftrightarrow{AB}$ ผ่านจุด $P$
และ $A\hat{P}Q$ เท่ากับมุมในส่วนโค้งที่อยู่ตรงข้ามกับคอร์ด $PQ$
แล้วจะสรุปได้ว่า ?
ตอบ: $\overleftrightarrow{AB}$ เป็น**เส้นสัมผัสวงกลม**ที่จุด $P$
รูปถาม:
\begin{tikzpicture}[scale=1]
\draw[thick] (0,0) circle (1.3);
\draw[thick,blue,dashed,<->] (-2,-1.3) -- (2,-1.3);
\node[below] at (0.000,-1.300) {$P$};
\node[below] at (-1.7,-1.3) {$A$};
\node[below] at (1.7,-1.3) {$B$};
\node[left] at (-1.126,0.650) {$Q$};
\draw[thick,red] (0.000,-1.300) -- (-1.126,0.650);
\fill[orange,opacity=0.35] (0.000,-1.300) -- ++(120.0:0.40) arc (120.0:180.0:0.40) -- cycle;
\draw[orange] (0.000,-1.300) ++(120.0:0.40) arc (120.0:180.0:0.40);
\node[orange] at (-0.606,-0.950) {$x^\circ$};
\draw[thick] (0.000,-1.300) -- (0.836,0.996);
\draw[thick] (0.836,0.996) -- (-1.126,0.650);
\fill[orange,opacity=0.35] (0.836,0.996) -- ++(-170.0:0.35) arc (-170.0:-110.0:0.35) -- cycle;
\draw[orange] (0.836,0.996) ++(-170.0:0.35) arc (-170.0:-110.0:0.35);
\node[orange] at (0.338,0.578) {$x^\circ$};
\node[above right] at (0.836,0.996) {$R$};
\end{tikzpicture}

*/};
