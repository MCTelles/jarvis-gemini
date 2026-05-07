import { defineConfig } from '@prisma/config';

export default defineConfig({
	datasource: {
		url: 'postgresql://marcelodacostatelles@localhost:5432/jarvis_db?schema=public',
	},
});
