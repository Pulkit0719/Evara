-- Additive migration: Support local authentication, passwords, and server-revocable sessions
ALTER TABLE `users` ADD COLUMN `passwordHash` varchar(255);
CREATE INDEX `users_email_idx` ON `users` (`email`);

CREATE TABLE `sessions` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`userAgent` varchar(255),
	`ipAddress` varchar(45),
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `sessions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade
);

CREATE INDEX `sessions_user_idx` ON `sessions` (`userId`);
CREATE INDEX `sessions_expires_at_idx` ON `sessions` (`expiresAt`);
