package com.inurum.dashcam.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

@Schema(description = "Standard paginated response wrapper")
public record PagedResponse<T>(
        @Schema(description = "Page items")
        List<T> items,

        @Schema(description = "Zero-based current page index", example = "0")
        int page,

        @Schema(description = "Number of items per page", example = "25")
        int size,

        @Schema(description = "Total number of items across all pages", example = "142")
        long totalItems,

        @Schema(description = "Total number of pages", example = "6")
        int totalPages,

        @Schema(description = "Whether this is the last page", example = "false")
        boolean last
) {
    public static <T> PagedResponse<T> of(List<T> items, int page, int size, long totalItems) {
        int totalPages = size > 0 ? (int) Math.ceil((double) totalItems / size) : 0;
        boolean last = (page + 1) >= totalPages;
        return new PagedResponse<>(items, page, size, totalItems, totalPages, last);
    }
}

