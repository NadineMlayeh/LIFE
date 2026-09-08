# How the page turn works

Written up because the technique is worth knowing outside this project. Nothing here is
specific to React, Three.js or LIFE — the mechanism is plain CSS 3D, and the last section is
about carrying it anywhere.

## What this covers

It covers what Monoprix/FlipHTML5 actually does (PDF → page images server-side → canvas/WebGL
flip in the browser — the flip has nothing to do with PDF), the four CSS ideas that do all the
work, and a copy-paste HTML+CSS version at the end that needs no framework at all.

Two things worth your time. First, **perspective belongs on the ancestor, not the rotating
element** — the most common CSS 3D mistake, and it is the difference between paper in a space
and a card spinning. Second, the honest ceiling: CSS transforms are affine, so they can rotate
and skew a flat plane but **cannot bow one**. The soft curl in the Monoprix catalogue is
exactly why they reach for canvas. Everything up to the curl is cheap and yours.

---

## 0. In plain terms

The rest of this document is precise. This section is the same thing without the jargon.

### What a "page turn" actually is on a screen

There is no page. There is a rectangle of HTML, and CSS can tilt that rectangle in 3D space.
Turning a page means: **tilt the rectangle around one of its edges, like a door swinging on a
hinge.** That is the entire trick. Everything else — shadows, timing, a blank back side — is
decoration on top of a swinging door.

### Why I did not use the ready-made library

`react-pageflip` was the obvious choice. Three things made it a bad bet:

**It is old.** Its last release was 2022. Our app runs React 19, which came out after that.
The library never says it supports React 19 — nobody has checked, because nobody is
maintaining it. It might work. "Might" is the problem.

**It does not pin its own ingredient.** A package lists what it needs. This one says it needs
`page-flip` at version `"latest"` — meaning _whatever the newest version is at the moment you
install_. So you and I could install the same library on the same day and get different code.
Worse, your project could build fine today and break in six months without you changing a
single line. That is genuinely dangerous in something you want to still work in a year.

**It wants to run the pages itself.** This is the important one.

### Why "owning the DOM" is bad here

The DOM is the live list of elements on the page. React's whole deal is: _React owns that
list._ You describe what things should look like, React works out which elements to create,
update and delete. It keeps a mental model of what is on screen and trusts that model.

A library like StPageFlip works differently. You hand it a container and it says "mine now" —
it moves elements around, clones them, rebuilds them when the page count changes, positions
them absolutely. It also keeps a mental model, and it also trusts it.

Two owners, two models, one set of elements. They disagree, and when they do you get bugs that
are miserable to debug: a text box that loses what you typed, a button that stops responding,
a page that renders twice.

**This matters more for us than for a catalogue**, and here is the difference. A Monoprix
catalogue is _dead pages_ — pictures that never change. Handing dead pictures to a library is
fine; nobody else wants them. Our pages are **alive**:

- captions and chapter text that save themselves while you type,
- confirmation bubbles that pop up over things,
- and a page count that _changes_ — add a photo and the album grows a leaf.

Every one of those is React needing to update an element that the flip library thinks it owns.
That is the fight. It is not that the library is bad; it is that it was built for a slideshow
of images and we have a live document.

### How I built ours instead

The key realisation: **in a real book, only one page moves.**

Open a book. The next page is not flying in from somewhere — it has been lying there under
your thumb the whole time. The page you are reading lifts up and swings over, and what was
already underneath is simply _uncovered_.

So:

1. **The new page is rendered normally.** Plain React, sitting in the layout exactly as it
   would if there were no animation at all. This is why nothing broke — React still owns it,
   the text boxes still work, no library is involved.
2. **The old page is photocopied.** When the page changes, I keep a copy of what was just on
   screen, lay it on top, and swing _that_ away like a door on a hinge.
3. **When the swing finishes, the copy is thrown away.**

That is it. React never loses ownership of anything real. The only thing being animated is a
throwaway copy that nobody is typing into.

Two smaller touches do most of the convincing:

- **The back side.** A page has two faces. Past halfway you should stop seeing the front and
  start seeing the blank reverse. Without that, the page just evaporates in mid-air.
- **The shadow.** A dark gradient that deepens as the page reaches edge-on and fades as it
  lands. This does more work than the rotation itself, because a shadow implies a light in the
  room and the rotation alone does not. Remove the shadow and it stops looking like paper.

### Why ours is not as good as Monoprix's

Two honest reasons.

**1. Their page bends. Ours cannot.**

Watch the catalogue closely: as the page lifts, it _curves_ — the paper bows like a real sheet
being picked up. CSS cannot do that. CSS can move, rotate, scale and slant a flat rectangle,
but it cannot bend one; a straight line stays straight, always. That is a hard limit of the
technology, not something I skipped.

To bend a page you have to stop treating it as HTML and start _drawing_ it — chop it into
strips on a `<canvas>` and paint each strip at a slightly different angle so the whole reads as
a curve. FlipHTML5 does exactly this. But once a page is painted onto a canvas it is a picture:
you cannot type in it, click a link in it, or select its text. Fine for a catalogue. Fatal for
a photo album where captions are edited in place.

So it is a real trade: **their curl, or our live pages. You cannot have both.**

**2. There is no drag.**

In the catalogue you can grab a corner and drag it, and the page follows your cursor, held
half-open until you let go. Ours plays a fixed animation when you click. Following a pointer
means tracking the cursor and mapping its position onto an angle every frame — perfectly
doable, just more code than a click has needed so far.

### What used to be here, and is now fixed

This section used to carry a third reason: the album showed **one page at a time**, so the
second half of every swing happened off the edge of the container and got clipped. A door
swinging 180° ends up _outside the doorway it started in_ — see section 3 — and a real
flipbook hides that by being a two-page spread, so the leaf lands on the other half.

The owner spotted the same thing from the other direction: _the whole spread was turning, when
realistically you only ever flip one page of it._ Both complaints have the same fix, and the
album is now a genuine spread. **The back face is visible.** Turning forward lifts the right
page and lands it on the left, showing its reverse on the way — which was the missing piece.

---

## 1. What FlipHTML5 (the Monoprix catalogue) actually does

The catalogue at `online.fliphtml5.com` is **not a PDF being displayed**. There is no page-flip
feature in PDF, and no browser PDF viewer does this. What happens is a three-step pipeline:

1. **Server-side, the PDF is taken apart into page images.** Each page becomes a raster image
   (usually several sizes, so the viewer can load a small one first and swap in a sharp one).
   Text may also be extracted separately to power the search box — that is why you can search
   a catalogue that is otherwise pictures.
2. **The browser gets a list of image URLs**, not a document. At that point the "book" is just
   an array of pictures plus a page count.
3. **The turn is animated in the browser.** FlipHTML5 draws the turning leaf on a `<canvas>`
   (with a WebGL path where available). Canvas is what lets it _bend_ the page — the soft
   curl where the paper bows as it lifts. That curl is the one part of the effect that plain
   CSS cannot do, because CSS transforms are affine: they can rotate, scale and skew a flat
   plane, but they cannot bow one.

So: **PDF → images (server) → canvas/WebGL flip (client).** The flip has nothing to do with
the PDF format at all. Any set of images, or any HTML, could be flipped the same way.

### The open-source equivalents

| Library                                                    | What it is                                                              | State                              |
| ---------------------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------- |
| [turn.js](http://www.turnjs.com/)                          | The original. jQuery-based. Made flipbooks popular.                     | Old                                |
| [StPageFlip](https://nodlik.github.io/StPageFlip/)         | TypeScript successor. Canvas _and_ HTML modes, soft curl, drag-to-peel. | The best of them, but unmaintained |
| [react-pageflip](https://github.com/Nodlik/react-pageflip) | React wrapper around StPageFlip                                         | Last published 2022                |

### Why this project did not use them

`react-pageflip` was the obvious candidate and was rejected on three specific grounds:

- **Last published 2022**, with no React 19 in its peer range. This app is on React 19.
- Its only dependency is declared as `"page-flip": "latest"` — **unpinned**. An install six
  months from now can resolve to different code than an install today. That is not acceptable
  in a project you want to still build in a year.
- **It takes ownership of the page DOM.** Our leaves are live React: autosaving textareas,
  portalled confirmation bubbles, and a page count that changes when you add a chapter or
  upload a photograph. Handing that DOM to a library that manages and re-initialises pages
  itself is where these integrations usually go wrong.

The effect is about sixty lines of CSS-driven React. Owning it was cheaper than owning the
risk.

---

## 2. The mechanism, from first principles

Four ideas do all the work. None of them need a framework.

### 2.1 Perspective belongs to the _viewer_, not the page

```css
.stage {
  perspective: 2200px;
} /* the container */
.leaf {
  transform: rotateY(-40deg);
}
```

`perspective` is how far the viewer's eye is from the plane of the screen. It must sit on an
**ancestor** of the thing rotating. Put it on the rotating element itself (via
`transform: perspective(2200px) rotateY(...)`) and every leaf gets its own private vanishing
point — which reads as a flat card spinning, not paper in a space. This is the single most
common mistake in CSS 3D.

Smaller values = more extreme, fish-eye foreshortening. Larger = flatter and calmer. 2200px on
a ~900px-wide panel is a gentle, expensive-looking amount.

### 2.2 The pivot is the spine

```css
.leaf {
  transform-origin: left center;
}
```

By default an element rotates about its own centre, which looks like a spinning card. A page is
hinged along the spine, so the origin has to move to the edge.

### 2.3 A sheet of paper has two sides

A single `<div>` rotated 180° shows you its _mirrored front_ — text backwards. Real paper shows
its reverse. You get that with two stacked faces:

```css
.face {
  position: absolute;
  inset: 0;
  backface-visibility: hidden;
}
.back {
  transform: rotateY(180deg);
}
```

`backface-visibility: hidden` means "when this face is pointing away from me, do not draw it".
The front is drawn from 0° to 90°; past 90° it turns away and vanishes, and the back — which
was pre-rotated 180°, so it is now facing you the right way round — takes over. The swap at 90°
is what your eye reads as _a sheet_, not a picture.

For this to work, the parent needs:

```css
.leaf {
  transform-style: preserve-3d;
}
```

Without it the children are flattened into the parent's plane and both faces render on top of
each other.

### 2.4 The shadow does more than the rotation

This is the part people leave out, and it is the part that sells it. A gradient overlay whose
opacity peaks at 90° and falls off at both ends implies a light source that the geometry alone
cannot. Two shadows are used here:

- one **on the leaf**, darkest when it is edge-on to the light;
- one **on the page underneath**, strongest at the start and fading as the leaf clears it —
  the shadow the lifted page casts on the page it is uncovering.

Take these away and the same rotation looks like a slide transition.

---

## 3. The one piece of geometry that decides your layout

**A 180° rotation about an edge always ends up outside the box it started in.**

Rotate a 400px-wide leaf about its left edge and at 180° it occupies the 400px to the _left_ of
that edge — entirely outside its original footprint. There is no way around this; it is what
rotating about an edge means.

This is why every real flipbook is a **two-page spread**. The container is two pages wide, the
turning leaf is the right-hand half, and at 180° it lands neatly on the left-hand half — still
inside the container. The reason a spread is the universal flipbook layout is not aesthetic. It
is the only layout where the whole turn is visible.

### What that means here

This is exactly why the album is laid out as a spread, and why the library is not.

**The album is a spread**, so the whole turn is visible: the right page lifts, swings across
the spine, and lands on the left half — inside the container the entire way. Its back face
shows on the second half of the swing, which is the part that makes it read as a sheet of
paper rather than a disappearing rectangle.

During that turn there are **four page faces on screen at once**: the left page staying put,
the front of the turning leaf, its back, and the next right-hand page being uncovered. That is
why the component addresses pages by _index_ rather than taking children — it has to be able
to draw pages from two different spreads simultaneously.

**The library deliberately has no page turn.** A chapter is one continuous block of writing,
not one side of a leaf. There is no spread to turn within, so the gesture would be decoration
claiming a structure that is not there. It settles quietly instead. _A page turn is only
honest where there is actually a page._

### The clipping trap

A transformed element **still contributes to its ancestor's scrollable overflow**. A leaf
swinging past the left edge will push a horizontal scrollbar into the panel for the duration
of the turn. `overflow: hidden` on the stage is therefore load-bearing, not cosmetic.

---

## 4. How it is put together in this project

[`frontend/src/components/paper/PageTurn.tsx`](../frontend/src/components/paper/PageTurn.tsx)
— one component, used by the album.

### The API

```tsx
<PageTurn
  leaf={leaf} // which spread is open; leaf n shows pages 2n and 2n+1
  direction={goingForward ? 1 : -1}
  renderPage={(pageIndex) => /* the content of that page, or null past the end */}
/>
```

Changing `leaf` is what triggers a turn. `direction` is `1` forward (the **right** page swings
left) or `-1` back (the **left** page swings right) — which is what your hand actually does.

### Why pages are addressed by index

The obvious API would take `children` — "here is the current spread" — and snapshot the old
one when it changes. That is what the first version did, and it was wrong for this, because
**during a turn the two halves belong to different spreads.** Turning forward from 2|3 to 4|5,
the left half still shows page 2 while the right half already shows page 5.

A snapshot cannot express that. A `renderPage(index)` function can: the component simply asks
for whichever four pages it needs, whenever it needs them.

```tsx
// Which page each slot shows, mid-turn:
const leftIndex = forward ? from * 2 : to * 2; // the half being left behind / uncovered
const rightIndex = (forward ? to : from) * 2 + 1;
const frontIndex = forward ? from * 2 + 1 : from * 2; // the leaf you lifted
const backIndex = forward ? to * 2 : to * 2 + 1; // its reverse
```

The front and back indices are the interesting pair: they are the two sides of **one sheet**,
which in a book are consecutive pages. Get that mapping right and the illusion holds; get it
wrong and the page turns over to reveal something that was never on its back.

### Why this keeps working with live React

Nothing is snapshotted or cloned. Every page — including the two on the sheet in mid-air — is
ordinary React, rendered from the same function that renders the static ones. React owns all
of it, start to finish. That is why the autosaving captions, the portalled bubbles and a page
count that grows when you upload keep working straight through a turn.

The only bookkeeping is noticing that `leaf` changed:

```tsx
useLayoutEffect(() => {
  if (shown.current === leaf) return;
  const from = shown.current;
  shown.current = leaf;
  setTurn({ from, to: leaf, dir: direction });
});
```

`useLayoutEffect`, not `useEffect` — it runs after render but _before the browser paints_. With
`useEffect` you get one frame of the new spread before the turn starts, which shows as a
flicker.

One practical consequence: **the neighbouring spread has to be loaded already.** The album
prefetches images for the leaf either side of the open one, or the sheet turns over to reveal
a placeholder instead of a photograph.

### Accessibility

`useReducedMotion()` skips the animation entirely for anyone who has asked their OS for less
motion. Their page simply changes. Do this in anything you build — a 3D flip is exactly the
kind of motion that makes some people ill.

---

## 5. Taking it elsewhere

The technique needs **no framework, no library, no canvas**. Here it is with nothing but HTML
and CSS:

```html
<div class="stage">
  <div class="leaf">
    <div class="face front">Page one</div>
    <div class="face back">Back of page one</div>
  </div>
</div>
```

```css
.stage {
  perspective: 2200px;
}

.leaf {
  position: relative;
  transform-origin: left center;
  transform-style: preserve-3d;
  transition: transform 0.6s cubic-bezier(0.36, 0.05, 0.24, 1);
}
.leaf.turned {
  transform: rotateY(-180deg);
}

.face {
  position: absolute;
  inset: 0;
  backface-visibility: hidden;
}
.back {
  transform: rotateY(180deg);
}
```

Add the class, the page turns. That is the entire core.

**What each layer buys you, so you can decide how far to go:**

| You want                                                      | You need                                                                                |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| A leaf that turns, with a real back face                      | CSS only — the snippet above                                                            |
| Timed shadows, interruptible turns, snapshots of live content | A JS animation layer (here: `motion`)                                                   |
| Drag-to-peel, following the cursor                            | Manual pointer maths, or StPageFlip                                                     |
| A **bowed** page — paper that curves as it lifts              | Canvas or WebGL. CSS transforms are affine and cannot bend a plane. This is the ceiling |

That last row is the honest boundary. Everything up to the curl is cheap and yours; the curl is
where FlipHTML5's canvas renderer earns its keep. In practice the curl is a smaller part of the
impression than the shadow work, which is why a careful CSS version gets you most of the way.

**Where it transfers:** onboarding carousels, recipe and manual viewers, photo albums,
e-readers, any "next/previous" that wants weight. It is framework-agnostic — the React here is
only doing snapshot bookkeeping. In Vue, Svelte or vanilla JS you would keep the outgoing node
around by whatever means that framework offers, and the CSS would be identical.
....
Why the library was a bad bet. Three reasons. It's from 2022 and React 19 came out after — it never claims to support our version, and nobody's maintaining it to check. It declares its own ingredient as "page-flip": "latest", meaning whatever's newest when you install — so your project could build today and break in six months without you touching a line. And it wants to run the pages itself.

Why that last one matters. The DOM is the live list of elements on screen. React's whole deal is that it owns that list — it keeps a mental model and trusts it. StPageFlip works the same way: hand it a container and it says "mine now", moving and rebuilding elements, keeping its own model. Two owners, two models, one set of elements. When they disagree you get the miserable kind of bug — a text box that loses what you typed, a button that stops responding.

And here's the difference that decided it: a Monoprix catalogue is dead pages. Pictures that never change. Handing those to a library is fine, nobody else wants them. Our pages are alive — captions saving as you type, bubbles popping over things, and a page count that grows when you add a photo. Every one of those is React needing to touch an element the flip library thinks it owns.

How ours works. The realisation is that in a real book, only one page moves. Open a book — the next page isn't flying in, it's been lying under your thumb the whole time. So: the new page renders completely normally, plain React, exactly as if there were no animation (that's why nothing broke). When the page changes I photocopy what was just on screen, lay the copy on top, swing that away like a door on a hinge, then throw it away. React never loses ownership of anything real; the only thing animating is a throwaway nobody's typing into.

Why it isn't Monoprix-perfect. Two honest reasons.

Their page bends — the paper bows as it lifts. CSS can move, rotate, scale and slant a flat rectangle but it cannot bend one; a straight line stays straight, always. That's a hard limit of the technology. To bend a page you stop treating it as HTML and start drawing it, chopping it into strips on a canvas. But once it's painted on a canvas it's a picture — you can't type in it or select its text. Fine for a catalogue, fatal for an album where captions are edited in place. So it's a real trade: their curl, or our live pages.

The second is geometry, not technology: a door swinging 180° ends up outside the doorway it started in. Real flipbooks hide that by being two-page spreads, so the page lands on the other half. We show one page, so the back half of the swing goes off the edge and gets clipped. That's a layout change, not an animation one — the back face is already built and correct, and would appear the day the album becomes a true spread.

One thing to flag: lines 7–11 of PAGE-TURN.md had my chat message pasted into them — duplicated text and a ## heading that had swallowed a paragraph. Since you'd asked for a simpler explanation in exactly that spot, I replaced that block rather than leaving a broken heading in a doc meant for learning from. Everything typechecks and builds.
On your question — will CSS ever bend a page and keep it writable?
Genuinely uncertain, and it's a good question because the two halves pull against each other.

The blocker isn't stubbornness, it's that CSS transforms are affine — matrix maths where straight lines must stay straight. Bending needs a different kind of function, and the whole layout and hit-testing engine assumes rectangles. Where's my cursor in this text? Which element did I click? Those are cheap on a rectangle and hard on a curved surface.

There's real movement, though. CSS Houdini was meant to open the paint and layout pipeline to developers, but browser support stalled. element() in Firefox can render a live element as an image — the right shape, but it snapshots, so it's not interactive either. The pattern in every attempt is the same: the moment you get the bend, you lose the typing.

My honest read: the browser will probably keep drawing a boundary between "laid-out interactive content" and "arbitrarily deformed surface", because clicking and text selection are defined in terms of rectangles all the way down. What I'd bet on instead is the trick getting cheaper — a WebGL surface that stays live because a real, invisible text input is kept in sync behind it. That's how some 3D UIs already fake it. Not CSS bending a page, but the same result from the other side.
