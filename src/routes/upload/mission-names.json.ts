import client from '$lib/client';
import type { RequestHandler } from '@sveltejs/kit';

export const get: RequestHandler = async function () {
	const names = (
		await client.mission.findMany({
			select: {
				name: true
			},
			where: {
				verified: true
			}
		})
	).map((mission) => mission.name);

	return {
		body: names
	};
};
