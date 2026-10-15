CREATE TABLE `quote_rate_limits` (
	`key` text NOT NULL,
	`bucket` integer NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`key`, `bucket`)
);
--> statement-breakpoint
CREATE TABLE `quotes` (
	`id` text PRIMARY KEY NOT NULL,
	`reference` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`name` text NOT NULL,
	`company` text DEFAULT '' NOT NULL,
	`phone` text NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`product` text NOT NULL,
	`thickness` text DEFAULT '' NOT NULL,
	`quantity` real NOT NULL,
	`unit` text NOT NULL,
	`city` text NOT NULL,
	`details` text DEFAULT '' NOT NULL,
	`request_id` text NOT NULL,
	`payload_hash` text NOT NULL,
	`privacy_notice_version` text NOT NULL,
	CONSTRAINT "quotes_status_allowed" CHECK("quotes"."status" IN ('new','contacted','quoted','closed')),
	CONSTRAINT "quotes_quantity_positive" CHECK("quotes"."quantity" > 0 AND "quotes"."quantity" <= 1000000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quotes_reference_unique` ON `quotes` (`reference`);--> statement-breakpoint
CREATE UNIQUE INDEX `quotes_request_id_unique` ON `quotes` (`request_id`);--> statement-breakpoint
CREATE INDEX `quotes_created_id_idx` ON `quotes` (`created_at`,`id`);