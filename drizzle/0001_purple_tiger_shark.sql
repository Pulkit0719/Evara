CREATE TABLE `periodLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`startDate` varchar(10) NOT NULL,
	`endDate` varchar(10),
	`flowIntensity` enum('light','medium','heavy') NOT NULL,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `periodLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reminders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`reminderType` enum('period','check_in','medication','appointment') NOT NULL,
	`title` varchar(80) NOT NULL,
	`scheduleTime` varchar(5) NOT NULL,
	`scheduleFrequency` enum('once','daily','monthly') NOT NULL,
	`notificationPreview` varchar(80) NOT NULL DEFAULT 'You have an Evara reminder.',
	`isEnabled` int NOT NULL DEFAULT 1,
	`scheduleCronTaskUid` varchar(65),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reminders_id` PRIMARY KEY(`id`),
	CONSTRAINT `reminders_task_uid_unique` UNIQUE(`scheduleCronTaskUid`)
);
--> statement-breakpoint
CREATE TABLE `symptomLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`logDate` varchar(10) NOT NULL,
	`symptom` varchar(40) NOT NULL,
	`severity` enum('mild','moderate','severe') NOT NULL,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `symptomLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `userProfiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`displayName` varchar(80) NOT NULL,
	`typicalCycleLength` int NOT NULL,
	`typicalPeriodDuration` int NOT NULL,
	`lastPeriodStart` varchar(10),
	`trackingGoals` json NOT NULL,
	`completedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `userProfiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `userProfiles_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `wellnessLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`logDate` varchar(10) NOT NULL,
	`mood` int,
	`energy` int,
	`sleepHours` int,
	`waterGlasses` int,
	`activityMinutes` int,
	`stress` int,
	`pain` int,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `wellnessLogs_id` PRIMARY KEY(`id`),
	CONSTRAINT `wellnessLogs_user_date_unique` UNIQUE(`userId`,`logDate`)
);
--> statement-breakpoint
ALTER TABLE `periodLogs` ADD CONSTRAINT `periodLogs_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reminders` ADD CONSTRAINT `reminders_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `symptomLogs` ADD CONSTRAINT `symptomLogs_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `userProfiles` ADD CONSTRAINT `userProfiles_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `wellnessLogs` ADD CONSTRAINT `wellnessLogs_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `periodLogs_owner_start_idx` ON `periodLogs` (`userId`,`startDate`);--> statement-breakpoint
CREATE INDEX `reminders_owner_idx` ON `reminders` (`userId`);--> statement-breakpoint
CREATE INDEX `symptomLogs_owner_date_idx` ON `symptomLogs` (`userId`,`logDate`);