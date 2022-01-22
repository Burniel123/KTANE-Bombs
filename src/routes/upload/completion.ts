import client from '$lib/client';
import type { Completion } from '$lib/types';
import type { EndpointOutput } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit/types/hooks';

export async function post({ request }: RequestEvent): Promise<EndpointOutput> {
	const {
		completion,
		missionName
	}: { completion: Completion; missionName: string } = await request.json();

	const mission = await client.mission.findFirst({
		where: { name: missionName },
		select: {
			id: true
		}
	});

	if (mission === undefined) {
		return {
			status: 406
		};
	}

	await client.completion.create({
		data: {
			...completion,
			mission: {
				connect: {
					id: mission.id
				}
			},
			first: false, // This will be set to the correct value once the completion is verified.
			verified: false
		}
	});

	return {
		status: 200
	};
}
