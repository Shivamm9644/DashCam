import urllib.request
import json
import sys

BASE_URL = "http://127.0.0.1:8080"
API_KEY = "inurum-tc-prod-key-2026"

def req(path, method="GET", data=None, headers=None):
    if headers is None:
        headers = {}
    body = json.dumps(data).encode("utf-8") if data is not None else None
    if data is not None and "Content-Type" not in headers:
        headers["Content-Type"] = "application/json"
    r = urllib.request.Request(BASE_URL + path, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r) as resp:
            content = resp.read().decode("utf-8")
            return resp.status, json.loads(content) if content else {}
    except urllib.error.HTTPError as e:
        err_content = e.read().decode("utf-8")
        try:
            return e.code, json.loads(err_content)
        except Exception:
            return e.code, {"raw": err_content}

def main():
    print("=== Inurum DashCam & TruckerCloud Integration Acceptance Tests ===")

    # 1. Test Login
    print("\n1. Testing Auth Login...")
    status, res = req("/api/v1/auth/login", method="POST", data={"email": "admin@inurum.com", "password": "InurumAdmin2026!"})
    print(f"Status: {status}")
    if status != 200 or "token" not in res:
        print("Login failed:", res)
        sys.exit(1)
    token = res["token"]
    auth_headers = {"Authorization": f"Bearer {token}"}
    tc_headers = {"X-API-KEY": API_KEY}
    print("Login successful! JWT acquired.")

    # 2. Test OpenAPI Docs
    print("\n2. Testing OpenAPI /v3/api-docs...")
    status, docs = req("/v3/api-docs", headers=auth_headers)
    print(f"Status: {status}, Title: {docs.get('info', {}).get('title')}, Endpoints: {len(docs.get('paths', {}))}")
    assert status == 200

    # 3. Create Vehicle with 17-char VIN & ECU Odometer
    print("\n3. Testing Vehicle Creation with Valid 17-char VIN & ECU Odometer...")
    veh_payload = {
        "plateNumber": "TRK-9001",
        "vin": "1HD1KAE12FB099999",
        "label": "Heavy Hauler 9001",
        "model": "Kenworth T680",
        "year": 2024,
        "odometerKm": 145230.8,
        "odometerSource": "ECU"
    }
    status, v_res = req("/api/v1/vehicles", method="POST", data=veh_payload, headers=auth_headers)
    print(f"Status: {status}, Vehicle: {v_res.get('vehicle', {}).get('id')}, Plate: {v_res.get('vehicle', {}).get('plateNumber')}")
    assert status in (200, 201)
    veh_id = v_res["vehicle"]["id"]

    # 4. Get Vehicle by ID
    print("\n4. Testing Vehicle Details API...")
    status, v_detail = req(f"/api/v1/vehicles/{veh_id}", headers=auth_headers)
    print(f"Status: {status}, VIN: {v_detail.get('vin')}, Odometer: {v_detail.get('odometer')}")
    assert status == 200
    assert v_detail.get("vin") == "1HD1KAE12FB099999"
    assert v_detail.get("odometer", {}).get("source") == "ECU"

    # 5. Create Driver
    print("\n5. Testing Driver Creation API...")
    drv_payload = {
        "name": "Marcus Vance",
        "phone": "+1-404-555-0188",
        "email": "marcus.vance@inurumfleet.com",
        "licenseNumber": "GA-CDL-882910",
        "licenseState": "GA",
        "assignedVehicleId": veh_id
    }
    status, d_res = req("/api/v1/drivers", method="POST", data=drv_payload, headers=auth_headers)
    print(f"Status: {status}, Driver ID: {d_res.get('id')}, Name: {d_res.get('name')}")
    assert status in (200, 201)
    drv_id = d_res["id"]

    # 6. Get Driver Details
    print("\n6. Testing Driver Details API...")
    status, d_detail = req(f"/api/v1/drivers/{drv_id}", headers=auth_headers)
    print(f"Status: {status}, License: {d_detail.get('licenseNumber')}, Assigned Plate: {d_detail.get('assignedVehiclePlate')}")
    assert status == 200
    assert d_detail.get("assignedVehicleId") == veh_id

    # 7. TruckerCloud Vehicles Integration Endpoint
    print("\n7. Testing TruckerCloud GET /api/v1/integrations/truckercloud/vehicles (via X-API-KEY)...")
    status, tc_vehs = req("/api/v1/integrations/truckercloud/vehicles", headers=tc_headers)
    print(f"Status: {status}, Total Vehicles: {tc_vehs.get('totalItems')}")
    assert status == 200

    # 8. TruckerCloud Vehicle by 17-char VIN
    print("\n8. Testing TruckerCloud GET /api/v1/integrations/truckercloud/vehicles/{vin}...")
    status, tc_vin_veh = req("/api/v1/integrations/truckercloud/vehicles/1HD1KAE12FB099999", headers=tc_headers)
    print(f"Status: {status}, VIN: {tc_vin_veh.get('vin')}, Odometer: {tc_vin_veh.get('odometer')}")
    assert status == 200
    assert tc_vin_veh.get("vin") == "1HD1KAE12FB099999"

    # 9. TruckerCloud Drivers Integration Endpoint
    print("\n9. Testing TruckerCloud GET /api/v1/integrations/truckercloud/drivers...")
    status, tc_drivers = req("/api/v1/integrations/truckercloud/drivers", headers=tc_headers)
    print(f"Status: {status}, Total Drivers: {tc_drivers.get('totalItems')}")
    assert status == 200

    # 10. TruckerCloud Telemetry Latest
    print("\n10. Testing TruckerCloud GET /api/v1/integrations/truckercloud/telemetry/latest...")
    status, tc_telemetry = req("/api/v1/integrations/truckercloud/telemetry/latest", headers=tc_headers)
    print(f"Status: {status}, Telemetry records: {len(tc_telemetry) if isinstance(tc_telemetry, list) else 0}")
    assert status == 200

    # 11. TruckerCloud Telemetry History / Breadcrumbs
    print("\n11. Testing TruckerCloud GET /api/v1/integrations/truckercloud/telemetry/history...")
    status, tc_hist = req("/api/v1/integrations/truckercloud/telemetry/history", headers=tc_headers)
    print(f"Status: {status}, Breadcrumb page items: {len(tc_hist.get('items', []))}")
    assert status == 200

    # 12. TruckerCloud Safety Events
    print("\n12. Testing TruckerCloud GET /api/v1/integrations/truckercloud/safety/events...")
    status, tc_events = req("/api/v1/integrations/truckercloud/safety/events", headers=tc_headers)
    print(f"Status: {status}, Total Events: {tc_events.get('totalItems')}")
    assert status == 200

    # 13. TruckerCloud Trips
    print("\n13. Testing TruckerCloud GET /api/v1/integrations/truckercloud/trips...")
    status, tc_trips = req("/api/v1/integrations/truckercloud/trips", headers=tc_headers)
    print(f"Status: {status}, Total Trips: {tc_trips.get('totalItems')}")
    assert status == 200

    print("\n========================================================")
    print("ALL 13 ACCEPTANCE TESTS PASSED SUCCESSFULLY!")
    print("========================================================")

if __name__ == "__main__":
    main()

