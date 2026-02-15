<script>
	import CardList from "./Cards.svelte";
	import Card from "./lib/components/CardProxy.svelte";

	/** @type {String} */
	export let anchor;
	/** @type {Array} */
	export let cards;
	/** @type {Boolean} */
	export let isLoading;
</script>

<section data-anchor={anchor}>
	<slot />

	<CardList>
		{#if isLoading}
			loading...
		{:else}
			{#each cards as card}
				<Card
					id={card.id}
					name={card.name}
					number={card.number}
					set={card.set}
					types={card.types}
					supertype={card.supertype}
					subtypes={card.subtypes}
					rarity={card.rarity}
				/>
			{/each}
		{/if}
	</CardList>
</section>
