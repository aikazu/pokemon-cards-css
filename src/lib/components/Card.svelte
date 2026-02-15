<script>
  import { spring } from "svelte/motion";
  import { onMount, onDestroy } from "svelte";
  import { activeCard } from "../stores/activeCard.js";
  import { orientation, resetBaseOrientation } from "../stores/orientation.js";
  import { clamp, round } from "../helpers/Math.js";
  import { getPointerSpringUpdate, getOrientationSpringUpdate } from "../helpers/cardInteraction.js";

  // data / pokemon props
  /** @type {String} */
  export let id = "";
  /** @type {String} */
  export let name = "";
  /** @type {String} */
  export let number = "";
  /** @type {String} */
  export let set = "";
  /** @type {String|Array} */
  export let types = "";
  /** @type {String|Array} */
  export let subtypes = "basic";
  /** @type {String} */
  export let supertype = "pokémon";
  /** @type {String} */
  export let rarity = "common";

  // image props
  /** @type {String} */
  export let img = "";
  /** @type {String} */
  export let back = "https://tcg.pokemon.com/assets/img/global/tcg-card-back-2x.jpg";
  /** @type {String} */
  export let foil = "";
  /** @type {String} */
  export let mask = "";

  // context/environment props
  /** @type {Boolean} */
  export let showcase = false;

  const randomSeed = {
    x: Math.random(),
    y: Math.random()
  }

  const cosmosPosition = { 
    x: Math.floor( randomSeed.x * 734 ), // Pokemon card image width in pixels
    y: Math.floor( randomSeed.y * 1280 ) // Pokemon card image height in pixels
  };

  let isTrainerGallery = false;

  let back_img = back;
  let front_img = "";
  let img_base = img.startsWith("http") ? "" : "https://images.pokemontcg.io/";


  let thisCard;
  let repositionTimer;
  let rafId = null;
  let pendingSpringUpdate = null;

  let active = false;
  let interacting = false;
  let firstPop = true;
  let loading = true;
  let isVisible = document.visibilityState === "visible";

  const springInteractSettings = { stiffness: 0.066, damping: 0.25 }; // Spring physics for card interaction feel
  const springPopoverSettings = { stiffness: 0.033, damping: 0.45 }; // Spring physics for popover animation (slower, bouncier)
  let springRotate = spring({ x: 0, y: 0 }, springInteractSettings);
  let springGlare = spring({ x: 50, y: 50, o: 0 }, springInteractSettings);
  let springBackground = spring({ x: 50, y: 50 }, springInteractSettings);
  let springRotateDelta = spring({ x: 0, y: 0 }, springPopoverSettings);
  let springTranslate = spring({ x: 0, y: 0 }, springPopoverSettings);
  let springScale = spring(1, springPopoverSettings);

  let showcaseInterval;
  let showcaseTimerStart;
  let showcaseTimerEnd;
  let showcaseRunning = showcase;

  /**
   * stops the showcase animation
   */
  const endShowcase = () => {
    if (showcaseRunning) {
      clearTimeout(showcaseTimerEnd);
      clearTimeout(showcaseTimerStart);
      clearInterval(showcaseInterval);
      showcaseRunning = false;
    }
  };

  /**
   * handle the pointer move event
   * @param {any} e the event
   */
  const interact = (e) => {
    
    endShowcase();

    if (!isVisible) {
      return (interacting = false);
    }
    
    // prevent other background cards being interacted with
    if ($activeCard && $activeCard !== thisCard) {
      return (interacting = false);
    }

    interacting = true;

    let clientX = e.clientX;
    let clientY = e.clientY;
    if (e.type === "touchmove") {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    pendingSpringUpdate = getPointerSpringUpdate(clientX, clientY, rect);

    // Schedule spring update for next frame if not already scheduled
    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        if (pendingSpringUpdate) {
          updateSprings(
            pendingSpringUpdate.background,
            pendingSpringUpdate.rotate,
            pendingSpringUpdate.glare
          );
          pendingSpringUpdate = null;
        }
        rafId = null;
      });
    }
  };

  /**
   * handle the pointer end event
   * @param {any} e the event
   * @param {Number} delay delay before snapping back
   */
  const interactEnd = (e, delay = 500) => { // Default delay before snap-back animation
    // Cancel any pending animation frame
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    pendingSpringUpdate = null;

    setTimeout(function () {
      const snapStiff = 0.01; // Soft spring for card returning to rest
      const snapDamp = 0.06; // Soft spring for card returning to rest
      interacting = false;

      springRotate.stiffness = snapStiff;
      springRotate.damping = snapDamp;
      springRotate.set({ x: 0, y: 0 }, { soft: 1 });

      springGlare.stiffness = snapStiff;
      springGlare.damping = snapDamp;
      springGlare.set({ x: 50, y: 50, o: 0 }, { soft: 1 });

      springBackground.stiffness = snapStiff;
      springBackground.damping = snapDamp;
      springBackground.set({ x: 50, y: 50 }, { soft: 1 });
    }, delay);
  };

  /**
   * handle the card click event
   * @param {any} e the event
   */
  const activate = (e) => {
    if ($activeCard && $activeCard === thisCard) {
      $activeCard = undefined;
    } else {
      $activeCard = thisCard;
      resetBaseOrientation();
      if (typeof window.gtag === "function") {
        window.gtag("event", "select_item", {
          item_list_id: "cards_list",
          item_list_name: "Pokemon Cards",
          items: [
            {
              item_id: id,
              item_name: name,
              item_category: set,
              item_category2: supertype,
              item_category3: subtypes,
              item_category4: rarity
            }
          ]
        });
      }

    }
  };

  /**
   * handle the card blur event
   * @param {any} e the event
   */
  const deactivate = (e) => {
    interactEnd();
    $activeCard = undefined;
  };

  /**
   * handle the keydown event
   * @param {any} e the event
   */
  const handleKeydown = (e) => {
    if (e.key === "Escape" && $activeCard && $activeCard === thisCard) {
      e.preventDefault();
      deactivate(e);
      e.currentTarget.blur();
    }
  };

  /**
   * handle the scroll event to reposition the active card
   * @param {any} e the event
   */
  const reposition = (e) => {
    clearTimeout(repositionTimer);
    repositionTimer = setTimeout(() => {
      if ($activeCard && $activeCard === thisCard) {
        setCenter();
      }
    }, 300); // Debounce delay for scroll repositioning
  };

  /**
   * calculate and set the center position for the active card
   */
  const setCenter = () => {
    const rect = thisCard.getBoundingClientRect(); // get element's size/position
    const view = document.documentElement; // get window/viewport size

    const delta = {
      x: round(view.clientWidth / 2 - rect.x - rect.width / 2),
      y: round(view.clientHeight / 2 - rect.y - rect.height / 2),
    };
    springTranslate.set({
      x: delta.x,
      y: delta.y,
    });
  };

  /**
   * animate the card into the popover position
   */
  const popover = () => {
    const rect = thisCard.getBoundingClientRect(); // get element's size/position
    let delay = 100;
    let scaleW = (window.innerWidth / rect.width) * 0.9;
    let scaleH = (window.innerHeight / rect.height) * 0.9;
    let scaleF = 1.75; // Maximum scale factor for card popover
    setCenter();
    if (firstPop) {
      delay = 1000; // Extra delay on first popover (allows spin animation)
      springRotateDelta.set({
        x: 360, // Full rotation degrees for first popover spin
        y: 0,
      });
    }
    firstPop = false;
    springScale.set(Math.min(scaleW, scaleH, scaleF));
    interactEnd(null, delay);
  };

  /**
   * animate the card back to its original position
   */
  const retreat = () => {
    springScale.set(1, { soft: true });
    springTranslate.set({ x: 0, y: 0 }, { soft: true });
    springRotateDelta.set({ x: 0, y: 0 }, { soft: true });
    interactEnd(null, 100);
  };

  /**
   * reset the card position and scale immediately
   */
  const reset = () => {
    interactEnd(null, 0);
    springScale.set(1, { hard: true });
    springTranslate.set({ x: 0, y: 0 }, { hard: true });
    springRotateDelta.set({ x: 0, y: 0 }, { hard: true });
    springRotate.set({ x: 0, y: 0 }, { hard: true });
  };

  $: {
    if ($activeCard && $activeCard === thisCard) {
      popover();
      active = true;
      // only listen for scroll when THIS card is the active popover
      window.addEventListener("scroll", reposition, { passive: true });
    } else {
      retreat();
      active = false;
      // stop listening when card is no longer active
      window.removeEventListener("scroll", reposition);
    }
  }


  let foilStyles = ``;
  const staticStyles = `
    --seedx: ${randomSeed.x};
    --seedy: ${randomSeed.y};
    --cosmosbg: ${cosmosPosition.x}px ${cosmosPosition.y}px;
  `;
  $: dynamicStyles = `
    --pointer-x: ${$springGlare.x}%;
    --pointer-y: ${$springGlare.y}%;
    --pointer-from-center: ${ 
      clamp( Math.sqrt( 
        ($springGlare.y - 50) * ($springGlare.y - 50) + 
        ($springGlare.x - 50) * ($springGlare.x - 50) 
      ) / 50, 0, 1) };
    --pointer-from-top: ${$springGlare.y / 100};
    --pointer-from-left: ${$springGlare.x / 100};
    --card-opacity: ${$springGlare.o};
    --rotate-x: ${$springRotate.x + $springRotateDelta.x}deg;
    --rotate-y: ${$springRotate.y + $springRotateDelta.y}deg;
    --background-x: ${$springBackground.x}%;
    --background-y: ${$springBackground.y}%;
    --card-scale: ${$springScale};
    --translate-x: ${$springTranslate.x}px;
    --translate-y: ${$springTranslate.y}px;
	`;

  $: {
    rarity = rarity.toLowerCase();
    supertype = supertype.toLowerCase();
    number = number.toLowerCase();
    isTrainerGallery = !!number.match(/^[tg]g/i) || !!( id === "swshp-SWSH076" || id === "swshp-SWSH077" );
    if (Array.isArray(types)) {
      types = types.join(" ").toLowerCase();
    }
    if (Array.isArray(subtypes)) {
      subtypes = subtypes.join(" ").toLowerCase();
    }
  }

  /**
   * update the card orientation based on device orientation
   * @param {any} e the orientation data
   */
  const orientate = (e) => {
    const springUpdate = getOrientationSpringUpdate(e.relative.gamma, e.relative.beta);
    updateSprings(springUpdate.background, springUpdate.rotate, springUpdate.glare);
  };

  /**
   * update the spring values for background, rotation, and glare
   * @param {Object} background background x/y values
   * @param {Object} rotate rotate x/y values
   * @param {Object} glare glare x/y/o values
   */
  const updateSprings = ( background, rotate, glare ) => {

    springBackground.stiffness = springInteractSettings.stiffness;
    springBackground.damping = springInteractSettings.damping;
    springRotate.stiffness = springInteractSettings.stiffness;
    springRotate.damping = springInteractSettings.damping;
    springGlare.stiffness = springInteractSettings.stiffness;
    springGlare.damping = springInteractSettings.damping;

    springBackground.set(background);
    springRotate.set(rotate);
    springGlare.set(glare);

  }

  $: {
    if ($activeCard && $activeCard === thisCard) {
      interacting = true;
      orientate($orientation);
    }
  }

  /**
   * handle the visibility change event
   */
  const handleVisibilityChange = () => {
    isVisible = document.visibilityState === "visible";
    endShowcase();
    reset();
  };

  /**
   * handle the card image load event
   * @param {any} e the event
   */
  const imageLoader = (e) => {
    loading = false;
    if ( mask || foil ) {
      foilStyles = `
    --mask: url(${mask});
    --foil: url(${foil});
      `;
    }
  };

  onMount(() => {

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // set the front image on mount so that
    // the lazyloading can work correctly
    front_img = img_base + img;

    // run a cute little animation on load
    // for showcase card
    if (showcase && isVisible) {
      let showTimer;
      const s = 0.02; // Showcase spring settings (very slow, smooth)
      const d = 0.5; // Showcase spring settings (very slow, smooth)
      let r = 0;
      showcaseTimerStart = setTimeout(() => {
        interacting = true;
        active = true;
        springRotate.stiffness = s;
        springRotate.damping = d;
        springGlare.stiffness = s;
        springGlare.damping = d;
        springBackground.stiffness = s;
        springBackground.damping = d;
        if (isVisible) {
          showcaseInterval = setInterval(function () {
            r += 0.05; // Showcase rotation increment per interval tick
            springRotate.set({ x: Math.sin(r) * 25, y: Math.cos(r) * 25 });
            springGlare.set({
              x: 55 + Math.sin(r) * 55,
              y: 55 + Math.cos(r) * 55,
              o: 0.8,
            });
            springBackground.set({
              x: 20 + Math.sin(r) * 20,
              y: 20 + Math.cos(r) * 20,
            });
          }, 20); // Showcase interval milliseconds (50fps)
          showcaseTimerEnd = setTimeout(() => {
            clearInterval(showcaseInterval);
            interactEnd(null, 0);
          }, 4000); // Showcase animation duration in ms
        } else {
          interacting = false;
          active = false;
          return;
        }
      }, 2000); // Delay before showcase animation starts
    }
  });

  onDestroy(() => {
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    window.removeEventListener("scroll", reposition);
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    clearTimeout(repositionTimer);
    clearInterval(showcaseInterval);
    clearTimeout(showcaseTimerStart);
    clearTimeout(showcaseTimerEnd);
  });
</script>


<div
  class="card {types} / interactive / "
  class:active
  class:interacting
  class:loading
  class:masked={!!mask}
  data-number={number}
  data-set={set}
  data-subtypes={subtypes}
  data-supertype={supertype}
  data-rarity={rarity}
  data-trainer-gallery={isTrainerGallery}
  style={dynamicStyles}
  bind:this={thisCard}
>
  <div 
    class="card__translater">
    <button
      class="card__rotator"
      on:click={activate}
      on:pointermove={interact}
      on:mouseout={interactEnd}
      on:blur={deactivate}
      on:keydown={handleKeydown}
      aria-label="Expand the Pokemon Card; {name}."
      aria-expanded={active}
      tabindex="0"
      >
      <img
        class="card__back"
        src={back_img}
        alt="The back of a Pokemon Card, a Pokeball in the center with Pokemon logo above and below"
        loading="lazy"
        width="660"
        height="921"
      />
      <div class="card__front" 
        style={ staticStyles + foilStyles }>
        <img
          src={front_img}
          alt="Front design of the {name} Pokemon Card, with the stats and info around the edge"
          on:load={imageLoader}
          loading="lazy"
          width="660"
          height="921"
        />
        <div class="card__shine"></div>
        <div class="card__glare"></div>
      </div>
    </button>
  </div>
</div>

<style>

  :root {
    --pointer-x: 50%;
    --pointer-y: 50%;
    --card-scale: 1;
    --card-opacity: 0;
    --translate-x: 0px;
    --translate-y: 0px;
    --rotate-x: 0deg;
    --rotate-y: 0deg;
    --background-x: var(--pointer-x);
    --background-y: var(--pointer-y);
    --pointer-from-center: 0;    
    --pointer-from-top: var(--pointer-from-center);
    --pointer-from-left: var(--pointer-from-center);
  }

</style>
