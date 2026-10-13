CREATE TABLE `sessions` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`userAgent` varchar(255),
	`ipAddress` varchar(45),
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `loginMethod` varchar(64) DEFAULT 'local';
--> statement-breakpoint
ALTER TABLE `users` ADD `passwordHash` varchar(255);
--> statement-breakpoint
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`userId`);
--> statement-breakpoint
CREATE INDEX `sessions_expires_at_idx` ON `sessions` (`expiresAt`);
--> statement-breakpoint
CREATE INDEX `users_email_idx` ON `users` (`email`);
