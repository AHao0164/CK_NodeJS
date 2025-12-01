# 52300019_52300013
import math
import os
import re
import cv2
import numpy as np


def format_label(raw_label):
    """
    Chuẩn hóa văn bản nhãn của mẫu (template) bằng cách loại bỏ các hậu tố số và thay thế dấu gạch dưới bằng khoảng trắng.
    Ví dụ: "stop_sign_01" -> "stop sign"
    """
    # Nếu nhãn không hợp lệ hoặc là -1, trả về "unknown"
    if raw_label in (None, -1):
        return "unknown"
    
    # Sử dụng Regex để loại bỏ phần gạch dưới và số ở cuối chuỗi (ví dụ: _1, _02)
    cleaned = re.sub(r"_\d+$", "", raw_label)
    
    # Thay thế các dấu gạch dưới còn lại bằng khoảng trắng để dễ đọc hơn
    return cleaned.replace("_", " ")


def load_reference_templates(reference_dir, detector):
    """
    Tải các ảnh mẫu từ ổ đĩa và tính toán trước các đặc trưng (descriptors) để dùng cho việc so khớp sau này.
    """
    templates = []
    # Duyệt qua từng file trong thư mục chứa ảnh mẫu
    for file_name in os.listdir(reference_dir):
        # Chỉ xử lý các file ảnh có đuôi .png, .jpg, .jpeg
        if not file_name.lower().endswith((".png", ".jpg", ".jpeg")):
            continue
        
        # Tạo đường dẫn đầy đủ đến file ảnh
        file_path = os.path.join(reference_dir, file_name)
        
        # Đọc ảnh dưới dạng ảnh xám (Grayscale) để giảm chi phí tính toán
        template_img = cv2.imread(file_path, cv2.IMREAD_GRAYSCALE)
        
        # Nếu không đọc được ảnh, bỏ qua
        if template_img is None:
            continue
        
        # Thay đổi kích thước ảnh mẫu về 500x500 để đồng bộ kích thước so khớp
        template_img = cv2.resize(template_img, (500, 500))
        
        # Sử dụng thuật toán (ví dụ SIFT) để phát hiện keypoints và tính descriptors
        keypoints, descriptors = detector.detectAndCompute(template_img, None)
        
        # Lưu thông tin mẫu vào danh sách
        templates.append(
            {
                "image": template_img,
                "keypoints": keypoints,
                "descriptors": descriptors,
                "label": file_name.split(".")[0], # Lấy tên file làm nhãn (bỏ đuôi mở rộng)
            }
        )
    return templates


def match_template(roi, templates, detector):
    """
    So khớp vùng quan tâm (ROI) với thư viện ảnh mẫu bằng BFMatcher và trả về nhãn tốt nhất.
    """
    # Resize ROI về cùng kích thước với template (500x500) để đảm bảo tính nhất quán
    roi = cv2.resize(roi, (500, 500))
    
    # Tính toán đặc trưng SIFT cho vùng ROI
    roi_keypoints, roi_descriptors = detector.detectAndCompute(roi, None)
    
    # Nếu không tìm thấy đặc trưng nào trong ROI, trả về "unknown"
    if roi_descriptors is None:
        return "unknown"

    # Khởi tạo BFMatcher với chuẩn L2 (Euclidean distance) và kiểm tra chéo (crossCheck=True) để tăng độ chính xác
    matcher = cv2.BFMatcher(cv2.NORM_L2, crossCheck=True)
    
    best_distance = float("inf") # Khởi tạo khoảng cách nhỏ nhất là vô cùng
    best_label = None

    # Duyệt qua từng mẫu trong danh sách templates
    for template in templates:
        # Nếu mẫu không có descriptors, bỏ qua
        if template["descriptors"] is None:
            continue
        
        # Thực hiện so khớp đặc trưng giữa ROI và Template
        matches = matcher.match(roi_descriptors, template["descriptors"])
        
        # Nếu không có điểm tương đồng nào, bỏ qua
        if not matches:
            continue
        
        # Tính khoảng cách trung bình của các điểm tương đồng (khoảng cách càng nhỏ càng giống nhau)
        average_distance = np.mean([match.distance for match in matches])
        
        # Nếu khoảng cách trung bình nhỏ hơn khoảng cách tốt nhất hiện tại, cập nhật lại
        if average_distance < best_distance:
            best_distance = average_distance
            best_label = template["label"]

    # Định dạng lại nhãn (bỏ số, thay _ bằng khoảng trắng) trước khi trả về
    return format_label(best_label)


def build_color_masks(frame):
    """
    Tạo các mặt nạ màu đỏ, xanh dương và vàng để làm nổi bật các vùng có khả năng là biển báo.
    """
    # Chuyển đổi không gian màu từ BGR sang HSV (Hue, Saturation, Value) để tách màu tốt hơn
    frame_hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)

    # Tạo mặt nạ màu đỏ: Màu đỏ nằm ở 2 đầu của dải Hue trong HSV
    # Dải 1: Hue từ 0 đến 10
    red_mask1 = cv2.inRange(frame_hsv, np.array([0, 50, 50]), np.array([10, 255, 255]))
    # Dải 2: Hue từ 160 đến 180
    red_mask2 = cv2.inRange(frame_hsv, np.array([160, 50, 50]), np.array([180, 255, 255]))
    # Kết hợp 2 dải màu đỏ
    red_mask = red_mask1 | red_mask2

    # Tạo mặt nạ màu xanh dương (Hue từ 100 đến 140)
    blue_mask = cv2.inRange(frame_hsv, np.array([100, 100, 100]), np.array([140, 255, 255]))
    
    # Tạo mặt nạ màu vàng (Hue từ 15 đến 35)
    yellow_mask = cv2.inRange(frame_hsv, np.array([15, 100, 100]), np.array([35, 255, 255]))

    # Tạo kernel 5x5 để dùng cho các phép toán hình thái học
    kernel = np.ones((5, 5), np.uint8)
    
    # Áp dụng Gaussian Blur để giảm nhiễu, sau đó dùng phép đóng (Morphological Close) để lấp đầy các lỗ nhỏ trong mask
    red_mask = cv2.morphologyEx(cv2.GaussianBlur(red_mask, (5, 5), 0), cv2.MORPH_CLOSE, kernel)
    blue_mask = cv2.morphologyEx(cv2.GaussianBlur(blue_mask, (7, 7), 0), cv2.MORPH_CLOSE, kernel)
    yellow_mask = cv2.morphologyEx(cv2.GaussianBlur(yellow_mask, (5, 5), 0), cv2.MORPH_CLOSE, kernel)

    return red_mask, blue_mask, yellow_mask


def is_valid_sign_area(contour):
    """
    Loại bỏ nhanh các đường viền có diện tích quá nhỏ (nhiễu) hoặc quá lớn (không phải biển báo).
    """
    area = cv2.contourArea(contour)
    # Chỉ chấp nhận diện tích từ 2000 đến 15000 pixel
    return 2000 <= area <= 15000


def detect_circle_shape(gray_image, contour, min_radius=15, max_radius=80):
    """
    Xác minh đường viền hình tròn bằng cách kiểm tra độ tròn và xác nhận lại bằng Hough Circles.
    """
    # Tính chu vi đường viền
    perimeter = cv2.arcLength(contour, True)
    # Tính diện tích
    area = cv2.contourArea(contour)
    
    # Tính độ tròn (Circularity): 4 * pi * Area / Perimeter^2. Hình tròn hoàn hảo = 1.0
    circularity = 4 * np.pi * area / (perimeter * perimeter) if perimeter else 0
    
    # Nếu độ tròn nhỏ hơn 0.74, coi như không phải hình tròn
    if circularity < 0.74:
        return None

    # Làm mờ ảnh xám để giảm nhiễu biên trước khi dùng Hough
    blurred = cv2.GaussianBlur(gray_image, (7, 7), 2.5)
    
    # Sử dụng Hough Circle Transform để phát hiện hình tròn chính xác hơn
    circles = cv2.HoughCircles(
        blurred,
        cv2.HOUGH_GRADIENT,
        dp=1.5,           # Tỉ lệ nghịch đảo độ phân giải
        minDist=35,       # Khoảng cách tối thiểu giữa các tâm
        param1=60,        # Ngưỡng trên cho Canny edge detector
        param2=25,        # Ngưỡng tích lũy (càng nhỏ càng nhạy)
        minRadius=min_radius,
        maxRadius=max_radius,
    )
    # Trả về None nếu không tìm thấy, ngược lại trả về thông số hình tròn
    return None if circles is None else np.uint16(np.around(circles[0]))


def is_triangle_shape(contour):
    """
    Đảm bảo đường viền là hình tam giác bằng cách xấp xỉ đa giác, kiểm tra tỷ lệ khung hình và các góc.
    """
    # Tính chu vi
    perimeter = cv2.arcLength(contour, True)
    
    # Xấp xỉ đường viền thành đa giác đơn giản hơn với độ sai số epsilon (4% chu vi)
    polygon = cv2.approxPolyDP(contour, 0.04 * perimeter, True)
    
    # Nếu đa giác xấp xỉ không có đúng 3 đỉnh, không phải tam giác
    if len(polygon) != 3:
        return False

    # Lấy hình chữ nhật bao quanh (Bounding Rect)
    x, y, w, h = cv2.boundingRect(contour)
    
    # Tính tỷ lệ khung hình (Width / Height). Biển báo tam giác thường có tỷ lệ gần 1.0
    aspect_ratio = float(w) / h if h else 0
    if not 0.8 <= aspect_ratio <= 1.2:
        return False

    # Hàm nội bộ để tính góc giữa 3 điểm sử dụng định lý Cosin
    def calculate_angle(p1, p2, p3):
        edge1 = np.linalg.norm(p1 - p2)
        edge2 = np.linalg.norm(p2 - p3)
        edge3 = np.linalg.norm(p3 - p1)
        denominator = 2 * edge1 * edge2
        if denominator == 0:
            return 0
        cosine = (edge1**2 + edge2**2 - edge3**2) / denominator
        # Giới hạn giá trị cosine trong khoảng [-1, 1] để tránh lỗi
        cosine = np.clip(cosine, -1, 1)
        # Chuyển đổi từ radian sang độ
        return math.degrees(math.acos(cosine))

    angles = []
    # Tính 3 góc của tam giác
    for i in range(3):
        p1 = polygon[i][0]
        p2 = polygon[(i + 1) % 3][0]
        p3 = polygon[(i + 2) % 3][0]
        angles.append(calculate_angle(p1, p2, p3))

    # Kiểm tra nếu tất cả các góc đều nằm trong khoảng hợp lý (40 đến 85 độ)
    return all(40 <= angle <= 85 for angle in angles)


def is_box_inside(inner_box, outer_box):
    """
    Kiểm tra xem inner_box có nằm hoàn toàn bên trong outer_box hay không.
    Format box: (x, y, x+w, y+h) - tức là (x1, y1, x2, y2)
    """
    return (
        inner_box[0] >= outer_box[0]    # x1 trong >= x1 ngoài
        and inner_box[1] >= outer_box[1]# y1 trong >= y1 ngoài
        and inner_box[2] <= outer_box[2]# x2 trong <= x2 ngoài
        and inner_box[3] <= outer_box[3]# y2 trong <= y2 ngoài
    )


def filter_contained_boxes(boxes):
    """
    Loại bỏ các hộp nằm hoàn toàn bên trong các hộp khác để tránh phát hiện trùng lặp.
    """
    filtered = []
    for i, box_a in enumerate(boxes):
        contained = False
        for j, box_b in enumerate(boxes):
            if i == j: # Không so sánh với chính nó
                continue
            # Nếu box_a nằm trong box_b, đánh dấu là bị chứa
            if is_box_inside(box_a, box_b):
                contained = True
                break
        # Chỉ giữ lại box_a nếu nó không nằm trong box nào khác
        if not contained:
            filtered.append(box_a)
    return filtered


def detect_signs_in_frame(frame, template_sources, detector):
    """
    Chạy luồng phát hiện đầy đủ trên từng khung hình: tạo mask màu, lọc hình học, phân loại mẫu, vẽ kết quả.
    """
    # Bước 1: Tạo các mask màu
    red_mask, blue_mask, yellow_mask = build_color_masks(frame)

    # Bước 2: Tìm các đường viền (contours) trên từng mask
    yellow_contours, _ = cv2.findContours(yellow_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    red_contours, _ = cv2.findContours(red_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    blue_contours, _ = cv2.findContours(blue_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    detections = []

    # --- Xử lý biển báo ĐỎ (thường là hình tròn cấm) ---
    for contour in red_contours:
        # Kiểm tra diện tích hợp lệ
        if not is_valid_sign_area(contour):
            continue
        
        # Cắt vùng quan tâm (ROI)
        x, y, w, h = cv2.boundingRect(contour)
        roi = frame[y : y + h, x : x + w]
        gray_roi = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
        
        # Kiểm tra hình dạng TRÒN
        if detect_circle_shape(gray_roi, contour) is not None:
            # So khớp với danh sách mẫu đỏ
            label = match_template(roi, template_sources["red"], detector)
            detections.append((x, y, x + w, y + h, label))

    # --- Xử lý biển báo XANH (thường là hình tròn chỉ dẫn) ---
    for contour in blue_contours:
        if not is_valid_sign_area(contour):
            continue
        x, y, w, h = cv2.boundingRect(contour)
        roi = frame[y : y + h, x : x + w]
        gray_roi = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
        
        # Kiểm tra hình dạng TRÒN
        if detect_circle_shape(gray_roi, contour) is not None:
            # So khớp với danh sách mẫu khác
            label = match_template(roi, template_sources["others"], detector)
            detections.append((x, y, x + w, y + h, label))

    # --- Xử lý biển báo VÀNG (thường là hình tam giác cảnh báo) ---
    for contour in yellow_contours:
        if not is_valid_sign_area(contour):
            continue
        x, y, w, h = cv2.boundingRect(contour)
        gray_roi = cv2.cvtColor(frame[y : y + h, x : x + w], cv2.COLOR_BGR2GRAY)
        
        # Kiểm tra hình dạng TAM GIÁC
        if is_triangle_shape(contour):
            # So khớp với danh sách mẫu
            label = match_template(gray_roi, template_sources["others"], detector)
            detections.append((x, y, x + w, y + h, label))

    # Bước 3: Lọc các hộp trùng lặp (nằm lồng nhau)
    detections = filter_contained_boxes(detections)
    
    # Bước 4: Vẽ kết quả lên khung hình
    for box in detections:
        # Vẽ hình chữ nhật bao quanh màu đỏ
        cv2.rectangle(frame, (box[0], box[1]), (box[2], box[3]), (0, 0, 255), 2)
        # Viết tên nhãn màu vàng
        cv2.putText(frame, box[4], (box[0], box[1] - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 255, 255), 2)
    
    return frame


def process_video(input_path, output_path):
    """
    Thực thi luồng phát hiện biển báo giao thông trên toàn bộ video và báo cáo tiến độ.
    """
    # Mở video đầu vào
    video_capture = cv2.VideoCapture(input_path)
    if not video_capture.isOpened():
        print("Lỗi: Không thể mở video đầu vào.")
        return

    # Lấy thông số video (chiều rộng, cao, fps, tổng số frame)
    frame_width = int(video_capture.get(cv2.CAP_PROP_FRAME_WIDTH))
    frame_height = int(video_capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = max(1, int(video_capture.get(cv2.CAP_PROP_FPS)))
    total_frames = int(video_capture.get(cv2.CAP_PROP_FRAME_COUNT)) or 0

    # Khởi tạo VideoWriter để lưu kết quả
    video_writer = cv2.VideoWriter(
        output_path,
        cv2.VideoWriter_fourcc(*"XVID"), # Codec XVID cho file .avi
        fps,
        (frame_width, frame_height),
    )

    # Khởi tạo bộ phát hiện đặc trưng SIFT (Scale-Invariant Feature Transform)
    detector = cv2.SIFT_create(
        nfeatures=1000,         # Số lượng keypoint tối đa
        contrastThreshold=0.01, # Ngưỡng tương phản
        edgeThreshold=15,       # Ngưỡng cạnh
        sigma=1.1,              # Độ làm mờ Gaussian
        nOctaveLayers=8,        # Số lớp trong mỗi octave
    )
    
    # Tải các mẫu ảnh tham chiếu từ thư mục
    other_templates = load_reference_templates("templates/", detector)
    red_templates = load_reference_templates("red_templates/", detector)
    
    # Gom nhóm mẫu vào dictionary để dễ truy xuất
    template_sources = {"red": red_templates, "others": other_templates}

    # Văn bản watermark (MSSV)
    watermark = "52300019_52300013"
    processed_frames = 0
    previous_progress = -1.0

    print(f"Bắt đầu xử lý video: {input_path}")
    
    # Vòng lặp xử lý từng frame
    while video_capture.isOpened():
        has_frame, frame = video_capture.read()
        if not has_frame:
            break

        processed_frames += 1
        
        # Thêm watermark vào góc dưới bên trái video
        cv2.putText(frame, watermark, (10, frame_height - 10), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2, cv2.LINE_AA)

        # Gọi hàm phát hiện biển báo cho frame hiện tại
        processed = detect_signs_in_frame(frame, template_sources, detector)
        
        # Ghi frame đã xử lý vào video đầu ra
        video_writer.write(processed)

        # Hiển thị tiến độ xử lý
        if total_frames:
            progress = (processed_frames / total_frames) * 100
            # Chỉ in tiến độ khi tăng ít nhất 1% để tránh spam console
            if progress - previous_progress >= 1:
                print(f"Tiến độ: {processed_frames}/{total_frames} ({progress:.1f}%)", end="\r")
                previous_progress = progress
        elif processed_frames % 30 == 0:
            print(f"Đã xử lý {processed_frames} frames...", end="\r")

    # Giải phóng tài nguyên
    video_capture.release()
    video_writer.release()
    cv2.destroyAllWindows()
    print(f"\nHoàn tất: video đã được lưu tại {output_path}")


if __name__ == "__main__":
    # Đường dẫn file video đầu vào và đầu ra
    INPUT_VIDEO_PATH = "video1.mp4"
    OUTPUT_VIDEO_PATH = "video1_output.avi"
    
    # INPUT_VIDEO_PATH = "video2.mp4"
    # OUTPUT_VIDEO_PATH = "video2_output.avi"

    # Chạy hàm xử lý chính
    process_video(INPUT_VIDEO_PATH, OUTPUT_VIDEO_PATH)