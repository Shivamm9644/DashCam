package com.inurum.dashcam.security;

import java.util.Set;


public final class Roles {
    public static final String SUPER_ADMIN = "SUPER_ADMIN";
    public static final String ADMIN = "ADMIN";
    public static final String DISPATCHER = "DISPATCHER";
    public static final String SAFETY_MANAGER = "SAFETY_MANAGER";
    public static final String CUSTOMER = "CUSTOMER";

    public static final Set<String> ALL = Set.of(SUPER_ADMIN, ADMIN, DISPATCHER, SAFETY_MANAGER, CUSTOMER);

    private Roles() {
    }
}
