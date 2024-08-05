import client from '$lib/client';
import { FrontendUser } from '$lib/types';

function diff(beforeObject: any, afterObject: any) {
	const before: { [id: string]: any } = {};
	const after: { [id: string]: any } = {};
	for (const key in afterObject) {
		if (JSON.stringify(beforeObject[key]) != JSON.stringify(afterObject[key])) {
			console.log(`key: ${key}`);
			console.log(`before: ${beforeObject[key]}`);
			console.log(`after: ${afterObject[key]}`);
			before[key] = beforeObject[key];
			after[key] = afterObject[key];
		}
	}
	console.log('');
	return [before, after];
}

const auditTables: { [id: string]: any } = {
	Completion: client.completion,
	Mission: client.mission,
	MissionPack: client.missionPack,
	User: client.user
};

function findName(record: any, model: string): string {
	if (model === 'Completion')
		return (
			(record.mission ? record.mission.name : 'Unknown') + '||' + (record.team ? record.team.join(', ') : 'Unknown')
		);
	else if (model === 'User') return record.username ?? 'Unknown';
	return record.name ?? 'Unknown';
}

const auditOperations: { [id: string]: any } = {
	async update(user: FrontendUser, modelObject: any, model: string, args: any, query: any) {
		const record = await modelObject.findFirst({ where: args.where });

		const [before, after] = diff(record, args.data);
		let name = findName(record, model);

		if (Object.keys(before).length > 0 || Object.keys(after).length > 0)
			await client.auditLog.create({
				data: {
					userId: user.id,
					model: model,
					recordId: record.id.toString(),
					name: name,
					action: 'update',
					before: before,
					after: after
				}
			});

		return query(args);
	},
	async delete(user: FrontendUser, modelObject: any, model: string, args: any, query: any) {
		const record = await modelObject.findFirst({ where: args.where });
		let name = findName(record, model);

		await client.auditLog.create({
			data: {
				userId: user.id,
				model: model,
				recordId: record.id.toString(),
				name: record.name,
				action: 'delete',
				before: record
			}
		});

		return query(args);
	},
	async deleteMany(user: FrontendUser, modelObject: any, model: string, args: any, query: any) {
		const records = await modelObject.findMany({ where: args.where });

		for (const record of records) {
			let name = findName(record, model);
			await client.auditLog.create({
				data: {
					userId: user.id,
					model: model,
					recordId: record.id.toString(),
					name: record.name,
					action: 'delete',
					before: record
				}
			});
		}

		return query(args);
	},
	async updateMany(user: FrontendUser, modelObject: any, model: string, args: any, query: any) {
		const records = await modelObject.findMany({ where: args.where });

		for (const record of records) {
			const [before, after] = diff(record, args.data);
			let name = findName(record, model);

			if (Object.keys(before).length > 0 || Object.keys(after).length > 0)
				await client.auditLog.create({
					data: {
						userId: user.id,
						model: model,
						recordId: record.id.toString(),
						name: record.name,
						action: 'update',
						before: before,
						after: after
					}
				});
		}

		return query(args);
	},
	async create(user: FrontendUser, modelObject: any, model: string, args: any, query: any) {
		const record = await query(args);
		let name = findName(record, model);

		await client.auditLog.create({
			data: {
				userId: user.id,
				model: model,
				recordId: record.id.toString(),
				name: record.name,
				action: 'create'
				// after: record
			}
		});

		return record;
	},
	async upsert(user: FrontendUser, modelObject: any, model: string, args: any, query: any) {
		const record = await modelObject.findFirst({ where: args.where });
		let name = findName(record, model);

		if (record) {
			//update
			const [before, after] = diff(record, args.update);

			if (Object.keys(before).length > 0 || Object.keys(after).length > 0)
				await client.auditLog.create({
					data: {
						userId: user.id,
						model: model,
						recordId: record.id.toString(),
						name: record.name,
						action: 'update',
						before: before,
						after: after
					}
				});

			return query(args);
		} else {
			//create

			const record = await query(args);

			await client.auditLog.create({
				data: {
					userId: user.id,
					model: model,
					recordId: record.id.toString(),
					name: record.name,
					action: 'create',
					after: record
				}
			});

			return record;
		}
	}
};

function createAuditClient(user: FrontendUser | null) {
	return client.$extends({
		name: 'Audit Log',
		query: {
			$allModels: {
				async $allOperations({ model, operation, args, query }) {
					if (!user || !model) return query(args);

					if (!auditTables[model] || !auditOperations[operation]) return query(args);

					return await auditOperations[operation](user, auditTables[model], model, args, query);
				}
			}
		},
		model: {
			auditLog: {
				async fromUser(userId: string) {
					return await client.auditLog.findMany({
						where: {
							userId: userId
						}
					});
				},
				async forCompletion(completionId: number) {
					return await client.auditLog.findMany({
						where: {
							model: 'Completion',
							recordId: completionId.toString()
						}
					});
				},
				async forMission(missionId: number) {
					return await client.auditLog.findMany({
						where: {
							model: 'Mission',
							recordId: missionId.toString()
						}
					});
				},
				async forMissionPack(missionPackId: number) {
					return await client.auditLog.findMany({
						where: {
							model: 'Missionpack',
							recordId: missionPackId.toString()
						}
					});
				},
				async forUser(userId: string) {
					return await client.auditLog.findMany({
						where: {
							model: 'User',
							recordId: userId
						}
					});
				}
			}
		}
	});
}

export default createAuditClient;
