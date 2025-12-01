import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'rootpw',
  database: 'auth_db',
  charset: 'utf8mb4',
  connectionLimit: 1
});

const termsContent = `ĐIỀU KHOẢN VÀ ĐIỀU KIỆN SỬ DỤNG

1. GIỚI THIỆU
Chào mừng bạn đến với website bán laptop GearUp của chúng tôi. Bằng việc truy cập và sử dụng website này, bạn đồng ý tuân thủ các điều khoản và điều kiện được quy định dưới đây. Vui lòng đọc kỹ toàn bộ nội dung trước khi sử dụng dịch vụ của chúng tôi.

GearUp là nền tảng thương mại điện tử chuyên cung cấp các sản phẩm laptop chính hãng, phụ kiện và dịch vụ hỗ trợ kỹ thuật. Chúng tôi cam kết mang đến cho khách hàng trải nghiệm mua sắm tốt nhất với sản phẩm chất lượng, giá cả cạnh tranh và dịch vụ khách hàng tận tâm.

Việc bạn tiếp tục sử dụng website sau khi có bất kỳ thay đổi nào về Điều khoản và Điều kiện này đồng nghĩa với việc bạn chấp nhận các điều khoản mới. Chúng tôi khuyến nghị bạn kiểm tra trang này thường xuyên để cập nhật các thay đổi.

2. ĐIỀU KHOẢN SỬ DỤNG

2.1. Đăng ký tài khoản
- Bạn phải từ đủ 18 tuổi trở lên hoặc có sự cho phép của cha mẹ/người giám hộ để đăng ký tài khoản
- Bạn phải cung cấp thông tin chính xác, đầy đủ và cập nhật khi đăng ký tài khoản
- Mỗi người chỉ được tạo một tài khoản duy nhất trên hệ thống
- Bạn chịu trách nhiệm bảo mật thông tin đăng nhập (email và mật khẩu) của mình
- Bạn phải thông báo ngay cho chúng tôi nếu phát hiện bất kỳ hành vi truy cập trái phép nào vào tài khoản
- Nghiêm cấm việc sử dụng tài khoản cho mục đích vi phạm pháp luật, gian lận hoặc làm tổn hại đến quyền lợi của người khác
- Chúng tôi có quyền đình chỉ hoặc xóa tài khoản nếu phát hiện hành vi vi phạm

2.2. Mua hàng và Đặt hàng
- Tất cả sản phẩm được hiển thị với giá, thông tin kỹ thuật và hình ảnh chính xác tại thời điểm đăng tải
- Giá sản phẩm đã bao gồm VAT (trừ khi có ghi chú khác)
- Chúng tôi có quyền từ chối hoặc hủy đơn hàng trong các trường hợp: thông tin không chính xác, sản phẩm hết hàng, nghi ngờ gian lận, hoặc các trường hợp bất khả kháng khác
- Giá sản phẩm có thể thay đổi mà không cần thông báo trước, nhưng không ảnh hưởng đến đơn hàng đã được xác nhận
- Đơn hàng chỉ được xác nhận sau khi bạn nhận được email xác nhận từ chúng tôi
- Bạn có thể hủy đơn hàng miễn phí trong vòng 1 giờ sau khi đặt hàng thành công
- Khách hàng có trách nhiệm kiểm tra kỹ thông tin đơn hàng (địa chỉ, số điện thoại, sản phẩm) trước khi xác nhận

2.3. Thanh toán
- Chúng tôi chấp nhận nhiều hình thức thanh toán: COD (thanh toán khi nhận hàng), chuyển khoản ngân hàng, thẻ tín dụng/ghi nợ, ví điện tử
- Đối với thanh toán chuyển khoản: Đơn hàng chỉ được xử lý sau khi xác nhận đã nhận được tiền
- Đối với thanh toán COD: Có thể áp dụng phí thu hộ tùy theo khu vực và giá trị đơn hàng
- Thông tin thanh toán của bạn được mã hóa và bảo mật theo tiêu chuẩn PCI-DSS
- Chúng tôi không lưu trữ thông tin thẻ tín dụng/ghi nợ của khách hàng

3. CHÍNH SÁCH GIAO HÀNG

3.1. Thời gian giao hàng
- Nội thành Hà Nội, TP.HCM: 1-2 ngày làm việc
- Các tỉnh thành khác: 3-5 ngày làm việc
- Khu vực xa trung tâm: 5-7 ngày làm việc
- Thời gian trên không bao gồm thứ 7, Chủ nhật và ngày lễ
- Thời gian giao hàng có thể chậm hơn trong các dịp cao điểm như: Black Friday, Tết Nguyên Đán, hoặc các sự kiện lớn

3.2. Phí vận chuyển
- Phí vận chuyển được tính dựa trên trọng lượng sản phẩm và địa chỉ giao hàng
- Miễn phí vận chuyển cho đơn hàng trên 15.000.000đ (áp dụng toàn quốc)
- Phí vận chuyển nội thành: 30.000đ - 50.000đ
- Phí vận chuyển ngoại thành: 50.000đ - 100.000đ
- Phí vận chuyển khu vực xa: 100.000đ - 200.000đ
- Phí vận chuyển sẽ được hiển thị rõ ràng trước khi bạn xác nhận đơn hàng

3.3. Giao hàng
- Nhân viên giao hàng sẽ liên hệ trước khi giao hàng 30-60 phút
- Khách hàng có trách nhiệm kiểm tra sản phẩm trước khi nhận hàng
- Nếu phát hiện sản phẩm bị hư hỏng, thiếu phụ kiện, vui lòng từ chối nhận hàng và liên hệ ngay với chúng tôi
- Sau khi ký nhận, chúng tôi không chịu trách nhiệm về các vấn đề liên quan đến vận chuyển
- Nếu khách hàng không có mặt sau 2 lần giao hàng, đơn hàng sẽ tự động bị hủy và có thể áp dụng phí vận chuyển

4. CHÍNH SÁCH ĐỔI TRẢ VÀ HOÀN TIỀN

4.1. Điều kiện đổi trả
- Chấp nhận đổi trả trong vòng 7 ngày kể từ ngày nhận hàng (theo dấu vận đơn)
- Sản phẩm phải còn nguyên vẹn, đầy đủ hộp, phụ kiện, tài liệu kèm theo
- Sản phẩm chưa qua sử dụng, không có dấu hiệu trầy xước, móp méo
- Tem niêm phong, tem bảo hành phải còn nguyên vẹn (nếu có)
- Hóa đơn mua hàng còn giá trị
- Các sản phẩm khuyến mãi, giảm giá đặc biệt có thể có chính sách đổi trả khác

4.2. Trường hợp được đổi trả miễn phí
- Sản phẩm bị lỗi do nhà sản xuất
- Sản phẩm không đúng với mô tả trên website
- Sản phẩm bị hư hỏng trong quá trình vận chuyển
- Giao nhầm sản phẩm, thiếu số lượng

4.3. Trường hợp khách hàng chịu phí vận chuyển
- Khách hàng đổi ý, không còn nhu cầu sử dụng
- Khách hàng đặt nhầm sản phẩm
- Chi phí vận chuyển đổi trả: 50.000đ - 150.000đ tùy theo khu vực

4.4. Quy trình đổi trả
- Liên hệ bộ phận chăm sóc khách hàng qua hotline hoặc email trong vòng 7 ngày
- Cung cấp thông tin đơn hàng, mã sản phẩm và lý do đổi trả
- Chúng tôi sẽ xác nhận yêu cầu và hướng dẫn gửi sản phẩm về
- Sau khi nhận và kiểm tra sản phẩm, chúng tôi sẽ xử lý đổi trả trong vòng 2-3 ngày làm việc
- Thời gian hoàn tiền: 5-7 ngày làm việc (đối với thanh toán online) hoặc 3-5 ngày (chuyển khoản ngân hàng)

4.5. Các trường hợp không áp dụng đổi trả
- Sản phẩm đã qua sử dụng, có dấu hiệu trầy xước, móp méo
- Sản phẩm thiếu hộp, phụ kiện, tài liệu
- Tem niêm phong, tem bảo hành bị rách, mất
- Quá thời hạn 7 ngày đổi trả
- Sản phẩm đã được nâng cấp phần cứng hoặc cài đặt phần mềm bởi bên thứ ba

5. CHÍNH SÁCH BẢO HÀNH

5.1. Thời gian bảo hành
- Laptop: 12-36 tháng (tùy theo hãng sản xuất)
- Phụ kiện: 3-12 tháng
- Chuột, bàn phím: 6-12 tháng
- Sạc, pin: 6 tháng
- Thời gian bảo hành được tính từ ngày mua hàng (theo hóa đơn)

5.2. Điều kiện bảo hành
- Sản phẩm còn trong thời hạn bảo hành
- Tem bảo hành còn nguyên vẹn
- Hóa đơn mua hàng hợp lệ
- Sản phẩm bị lỗi do nhà sản xuất
- Không áp dụng bảo hành cho các trường hợp: hư hỏng do người dùng, rơi vỡ, ngấm nước, cháy nổ, thay đổi phần cứng tự ý

5.3. Quy trình bảo hành
- Liên hệ bộ phận bảo hành qua hotline hoặc mang sản phẩm đến trung tâm bảo hành
- Cung cấp sản phẩm, hóa đơn và mô tả lỗi
- Kỹ thuật viên sẽ kiểm tra và báo giá sửa chữa (nếu không thuộc bảo hành)
- Thời gian bảo hành: 7-15 ngày làm việc (tùy theo mức độ hư hỏng)
- Khách hàng sẽ được thông báo khi sản phẩm hoàn tất bảo hành

5.4. Bảo hành mở rộng
- Khách hàng có thể mua thêm gói bảo hành mở rộng 1-2 năm
- Bảo hành VIP: Hỗ trợ ưu tiên, thời gian xử lý nhanh hơn
- Bảo hành tại nhà: Kỹ thuật viên đến tận nơi (áp dụng khu vực nội thành)

6. QUYỀN SỞ HỮU TRÍ TUỆ

6.1. Nội dung website
- Tất cả nội dung trên website (văn bản, hình ảnh, logo, video, âm thanh) thuộc quyền sở hữu của GearUp hoặc các đối tác được ủy quyền
- Nghiêm cấm sao chép, phân phối, sửa đổi, tái xuất bản nội dung mà không có sự cho phép bằng văn bản
- Vi phạm quyền sở hữu trí tuệ sẽ bị xử lý theo quy định pháp luật Việt Nam

6.2. Thương hiệu
- Tên thương hiệu "GearUp", logo và các biểu tượng liên quan là tài sản của chúng tôi
- Không được sử dụng thương hiệu GearUp cho mục đích thương mại mà không có sự cho phép

6.3. Quyền của khách hàng
- Bạn có quyền sử dụng website cho mục đích mua sắm cá nhân, phi thương mại
- Bạn có quyền tải xuống, in nội dung cho mục đích tham khảo cá nhân

7. GIỚI HẠN TRÁCH NHIỆM

7.1. Trách nhiệm của GearUp
- Chúng tôi cam kết cung cấp sản phẩm chính hãng, chất lượng
- Chúng tôi không chịu trách nhiệm về các thiệt hại phát sinh từ việc sử dụng sai mục đích sản phẩm
- Trách nhiệm của chúng tôi giới hạn ở giá trị sản phẩm đã mua
- Chúng tôi không chịu trách nhiệm về các sự cố do lỗi của đơn vị vận chuyển (sau khi đã bàn giao hàng)

7.2. Trách nhiệm của khách hàng
- Khách hàng có trách nhiệm bảo quản sản phẩm sau khi nhận hàng
- Khách hàng có trách nhiệm sử dụng sản phẩm đúng mục đích, tuân thủ hướng dẫn sử dụng
- Khách hàng có trách nhiệm cập nhật thông tin tài khoản chính xác

7.3. Bất khả kháng
- Chúng tôi không chịu trách nhiệm về các sự cố do thiên tai, chiến tranh, bạo loạn, đình công, dịch bệnh, hoặc các sự kiện bất khả kháng khác

8. CHÍNH SÁCH BẢO MẬT VÀ AN TOÀN THÔNG TIN
- Vui lòng tham khảo "Chính sách Bảo mật" của chúng tôi để biết thêm chi tiết về cách chúng tôi thu thập, sử dụng và bảo vệ thông tin cá nhân của bạn

9. GIẢI QUYẾT TRANH CHẤP

9.1. Thương lượng
- Mọi tranh chấp phát sinh sẽ được giải quyết thông qua thương lượng, hòa giải
- Khách hàng vui lòng liên hệ bộ phận chăm sóc khách hàng để được hỗ trợ

9.2. Luật áp dụng
- Các Điều khoản và Điều kiện này được điều chỉnh bởi pháp luật Việt Nam
- Mọi tranh chấp không giải quyết được bằng thương lượng sẽ được đưa ra Tòa án có thẩm quyền tại Việt Nam

10. THAY ĐỔI ĐIỀU KHOẢN
- Chúng tôi có quyền thay đổi, bổ sung các điều khoản này bất cứ lúc nào mà không cần thông báo trước
- Các thay đổi có hiệu lực ngay sau khi được đăng tải trên website
- Việc bạn tiếp tục sử dụng website sau khi có thay đổi đồng nghĩa với việc bạn chấp nhận các điều khoản mới
- Chúng tôi khuyến nghị bạn kiểm tra trang này thường xuyên để cập nhật

11. LIÊN HỆ VÀ HỖ TRỢ KHÁCH HÀNG

Nếu có bất kỳ câu hỏi nào về Điều khoản và Điều kiện, vui lòng liên hệ:

📧 Email hỗ trợ: support@gearup.vn
📞 Hotline: 1900 9999 (8:00 - 22:00 hàng ngày)
💬 Live Chat: Trên website (9:00 - 21:00)
📍 Địa chỉ văn phòng: Số 123, Đường Nguyễn Văn Linh, Quận 7, TP. Hồ Chí Minh
🏪 Showroom Hà Nội: Số 456, Đường Trần Duy Hưng, Quận Cầu Giấy, Hà Nội
🏪 Showroom TP.HCM: Số 789, Đường Lê Lợi, Quận 1, TP. Hồ Chí Minh

Thời gian làm việc:
- Thứ 2 - Thứ 6: 8:00 - 20:00
- Thứ 7 - Chủ nhật: 9:00 - 18:00

Website: https://gearup.vn
Facebook: fb.com/gearup.vn
Zalo OA: @gearupvn

Cảm ơn bạn đã tin tưởng và lựa chọn GearUp!

---
Cập nhật lần cuối: Tháng 11 năm 2025
Phiên bản: 1.0`;

const privacyContent = `CHÍNH SÁCH BẢO MẬT THÔNG TIN CÁ NHÂN

1. MỤC ĐÍCH VÀ PHẠM VI THU THẬP THÔNG TIN

1.1. Mục đích thu thập
GearUp cam kết bảo vệ quyền riêng tư và thông tin cá nhân của khách hàng. Chúng tôi thu thập thông tin cá nhân của bạn nhằm các mục đích sau:

- Xử lý đơn hàng: Xác nhận thông tin, đóng gói và giao hàng đến địa chỉ của bạn
- Cung cấp dịch vụ hỗ trợ khách hàng: Giải đáp thắc mắc, xử lý khiếu nại, hỗ trợ kỹ thuật
- Gửi thông tin khuyến mãi, ưu đãi (chỉ khi bạn đồng ý nhận email marketing)
- Cải thiện chất lượng dịch vụ: Phân tích hành vi người dùng, tối ưu trải nghiệm mua sắm
- Ngăn chặn gian lận: Xác thực tài khoản, phát hiện các hoạt động bất thường
- Tuân thủ pháp luật: Cung cấp thông tin khi có yêu cầu từ cơ quan có thẩm quyền

1.2. Phạm vi thu thập thông tin
Chúng tôi thu thập các loại thông tin sau:

Thông tin cá nhân:
- Họ và tên đầy đủ
- Địa chỉ email
- Số điện thoại
- Ngày sinh (nếu có)
- Giới tính (nếu có)

Thông tin địa chỉ:
- Địa chỉ giao hàng (tỉnh/thành phố, quận/huyện, phường/xã, địa chỉ chi tiết)
- Địa chỉ thanh toán (nếu khác với địa chỉ giao hàng)

Thông tin thanh toán:
- Phương thức thanh toán (COD, chuyển khoản, thẻ tín dụng/ghi nợ, ví điện tử)
- Thông tin thẻ ngân hàng (được mã hóa và xử lý bởi cổng thanh toán bên thứ ba)
- Lịch sử giao dịch

Thông tin hành vi:
- Lịch sử duyệt web, sản phẩm đã xem
- Giỏ hàng và sản phẩm yêu thích
- Lịch sử mua hàng và đơn hàng
- Tương tác với email marketing

Thông tin kỹ thuật:
- Địa chỉ IP
- Loại trình duyệt, thiết bị
- Hệ điều hành
- Cookies và dữ liệu tương tự

2. PHƯƠNG THỨC THU THẬP THÔNG TIN

2.1. Thông tin bạn cung cấp trực tiếp
- Khi đăng ký tài khoản
- Khi đặt hàng và thanh toán
- Khi liên hệ với bộ phận chăm sóc khách hàng
- Khi đăng ký nhận bản tin, ưu đãi
- Khi tham gia khảo sát, đánh giá sản phẩm

2.2. Thông tin thu thập tự động
- Cookies và công nghệ tương tự khi bạn sử dụng website
- Dữ liệu phân tích từ Google Analytics, Facebook Pixel
- Log files từ máy chủ web

2.3. Thông tin từ nguồn khác
- Từ các đối tác vận chuyển (trạng thái đơn hàng)
- Từ các nguồn công khai hợp pháp
- Từ các nền tảng mạng xã hội (nếu bạn đăng nhập qua Facebook, Google)

3. CÁCH THỨC SỬ DỤNG THÔNG TIN

Thông tin của bạn được sử dụng cho các mục đích sau:

Xử lý đơn hàng:
- Xác nhận thông tin khách hàng và đơn hàng
- Liên hệ giao hàng và thông báo tình trạng đơn hàng
- Xuất hóa đơn VAT (nếu có yêu cầu)

Hỗ trợ khách hàng:
- Giải đáp thắc mắc, xử lý khiếu nại
- Hỗ trợ kỹ thuật sản phẩm
- Xử lý đổi trả, bảo hành

Marketing và truyền thông:
- Gửi email thông báo về đơn hàng, khuyến mãi (nếu bạn đồng ý)
- Gửi SMS thông báo về trạng thái đơn hàng
- Hiển thị quảng cáo được cá nhân hóa trên website và các nền tảng khác

Cải thiện dịch vụ:
- Phân tích hành vi người dùng để tối ưu trải nghiệm
- Nghiên cứu thị trường và xu hướng tiêu dùng
- Phát triển sản phẩm và dịch vụ mới

Bảo mật và ngăn chặn gian lận:
- Xác thực danh tính người dùng
- Phát hiện và ngăn chặn các hoạt động đáng ngờ
- Bảo vệ quyền lợi của khách hàng và công ty

Tuân thủ pháp luật:
- Cung cấp thông tin khi có yêu cầu từ cơ quan có thẩm quyền
- Tuân thủ các quy định về thuế, kế toán

4. BẢO MẬT VÀ BẢO VỆ THÔNG TIN

Chúng tôi cam kết bảo mật thông tin của bạn bằng các biện pháp sau:

4.1. Mã hóa dữ liệu
- Sử dụng công nghệ mã hóa SSL/TLS 256-bit cho tất cả các giao dịch
- Mã hóa dữ liệu nhạy cảm trước khi lưu trữ
- Sử dụng HTTPS cho toàn bộ website

4.2. Lưu trữ an toàn
- Dữ liệu được lưu trữ trên máy chủ bảo mật, có tường lửa (firewall)
- Sao lưu dữ liệu định kỳ hàng ngày
- Áp dụng chính sách kiểm soát truy cập nghiêm ngặt

4.3. Quản lý truy cập
- Giới hạn quyền truy cập dữ liệu chỉ cho nhân viên có liên quan
- Tất cả nhân viên ký cam kết bảo mật thông tin khách hàng
- Đào tạo nhân viên về bảo mật thông tin định kỳ

4.4. Giám sát và cập nhật
- Thường xuyên cập nhật các bản vá bảo mật
- Giám sát hệ thống 24/7 để phát hiện các mối đe dọa
- Kiểm tra bảo mật định kỳ (penetration testing)

4.5. Thanh toán an toàn
- Không lưu trữ thông tin thẻ tín dụng/ghi nợ đầy đủ
- Sử dụng cổng thanh toán bên thứ ba đạt chuẩn PCI-DSS
- Xác thực hai yếu tố (2FA) cho các giao dịch lớn

5. CHIA SẺ THÔNG TIN VỚI BÊN THỨ BA

Chúng tôi cam kết KHÔNG bán, trao đổi hoặc cho thuê thông tin cá nhân của bạn cho bất kỳ bên thứ ba nào vì mục đích thương mại. Thông tin chỉ được chia sẻ trong các trường hợp sau:

5.1. Đối tác vận chuyển
- Để giao hàng, chúng tôi chia sẻ thông tin cần thiết (họ tên, số điện thoại, địa chỉ giao hàng)
- Các đối tác: Giao Hàng Nhanh, VNPost, J&T Express, Grab Express

5.2. Nhà cung cấp dịch vụ thanh toán
- Để xử lý thanh toán online
- Các đối tác: VNPay, Momo, ZaloPay, OnePay

5.3. Cơ quan pháp luật
- Khi có yêu cầu hợp pháp từ cơ quan có thẩm quyền
- Để tuân thủ pháp luật hoặc bảo vệ quyền lợi hợp pháp của công ty

5.4. Nhà cung cấp dịch vụ công nghệ
- Để duy trì và cải thiện website
- Các đối tác: Google Analytics, Facebook Pixel, email marketing service

Tất cả các bên thứ ba trên đều được yêu cầu tuân thủ chính sách bảo mật nghiêm ngặt và chỉ sử dụng thông tin cho mục đích đã nêu.

6. QUYỀN CỦA NGƯỜI DÙNG

Theo quy định của pháp luật Việt Nam về bảo vệ dữ liệu cá nhân, bạn có các quyền sau:

6.1. Quyền truy cập
- Xem thông tin cá nhân mà chúng tôi lưu trữ về bạn
- Tải xuống dữ liệu cá nhân của bạn

6.2. Quyền chỉnh sửa
- Yêu cầu chỉnh sửa thông tin không chính xác hoặc không đầy đủ
- Cập nhật thông tin tài khoản bất kỳ lúc nào

6.3. Quyền xóa dữ liệu
- Yêu cầu xóa tài khoản và dữ liệu cá nhân
- Lưu ý: Chúng tôi có thể giữ lại một số dữ liệu cần thiết theo quy định pháp luật (dữ liệu giao dịch, hóa đơn)

6.4. Quyền hạn chế xử lý
- Yêu cầu tạm dừng xử lý dữ liệu cá nhân trong một số trường hợp cụ thể

6.5. Quyền từ chối tiếp thị
- Hủy đăng ký nhận email marketing bất kỳ lúc nào (bằng cách click "Unsubscribe" trong email)
- Yêu cầu không nhận cuộc gọi hoặc tin nhắn quảng cáo

6.6. Quyền khiếu nại
- Khiếu nại về việc xử lý dữ liệu cá nhân không đúng quy định
- Liên hệ với cơ quan bảo vệ quyền lợi người tiêu dùng nếu không hài lòng với phản hồi của chúng tôi

Cách thực hiện quyền:
- Đăng nhập vào tài khoản và chỉnh sửa thông tin
- Liên hệ bộ phận chăm sóc khách hàng qua email: privacy@gearup.vn
- Gọi hotline: 1900 9999

7. COOKIES VÀ CÔNG NGHỆ TƯƠNG TỰ

7.1. Cookies là gì?
Cookies là các tệp văn bản nhỏ được lưu trữ trên thiết bị của bạn khi bạn truy cập website. Cookies giúp website ghi nhớ thông tin về lượt truy cập của bạn.

7.2. Loại cookies chúng tôi sử dụng

Cookies cần thiết:
- Ghi nhớ thông tin đăng nhập
- Duy trì phiên làm việc
- Lưu giỏ hàng
- Không thể tắt cookies này nếu muốn sử dụng website

Cookies chức năng:
- Ghi nhớ tùy chọn ngôn ngữ, giao diện
- Lưu lịch sử tìm kiếm
- Cải thiện trải nghiệm người dùng

Cookies phân tích:
- Theo dõi lượt truy cập, trang được xem nhiều nhất
- Phân tích hành vi người dùng (Google Analytics)
- Giúp cải thiện hiệu suất website

Cookies quảng cáo:
- Hiển thị quảng cáo phù hợp với sở thích
- Theo dõi hiệu quả chiến dịch quảng cáo (Facebook Pixel)
- Remarketing (hiển thị lại quảng cáo sản phẩm bạn đã xem)

7.3. Quản lý cookies
Bạn có thể:
- Tắt cookies trong trình duyệt (Cài đặt > Quyền riêng tư > Cookies)
- Xóa cookies đã lưu
- Chặn cookies từ các website cụ thể

Lưu ý: Tắt cookies có thể ảnh hưởng đến một số chức năng của website (đăng nhập, giỏ hàng, thanh toán).

8. THỜI GIAN LƯU TRỮ DỮ LIỆU

Thông tin của bạn được lưu trữ trong các khoảng thời gian sau:

Tài khoản đang hoạt động:
- Không giới hạn thời gian (cho đến khi bạn yêu cầu xóa)

Tài khoản không hoạt động:
- 24 tháng kể từ lần đăng nhập cuối cùng
- Sau đó, tài khoản sẽ bị đình chỉ và thông báo qua email
- Nếu không có phản hồi, tài khoản sẽ bị xóa sau 3 tháng

Dữ liệu giao dịch:
- 5 năm (theo quy định pháp luật về thuế, kế toán, bảo vệ người tiêu dùng)
- Bao gồm: hóa đơn, đơn hàng, lịch sử thanh toán

Cookies:
- 1-12 tháng tùy theo loại cookies
- Có thể xóa bất kỳ lúc nào trong trình duyệt

Dữ liệu marketing:
- Cho đến khi bạn hủy đăng ký nhận email
- Email sẽ bị xóa khỏi danh sách gửi ngay lập tức

9. BẢO MẬT THÔNG TIN TRẺ EM

- Website của chúng tôi không nhắm đến trẻ em dưới 16 tuổi
- Chúng tôi không cố ý thu thập thông tin cá nhân của trẻ em
- Nếu là cha mẹ/người giám hộ và phát hiện con em mình đã cung cấp thông tin cá nhân, vui lòng liên hệ với chúng tôi để xóa dữ liệu

10. THAY ĐỔI CHÍNH SÁCH BẢO MẬT

- Chúng tôi có thể cập nhật Chính sách Bảo mật này theo thời gian để phản ánh các thay đổi trong hoạt động kinh doanh hoặc yêu cầu pháp lý
- Mọi thay đổi quan trọng sẽ được thông báo qua email hoặc thông báo nổi bật trên website
- Chính sách mới có hiệu lực ngay sau khi được đăng tải
- Chúng tôi khuyến nghị bạn kiểm tra trang này định kỳ để cập nhật

11. CHUYỂN GIAO DỮ LIỆU QUỐC TẾ

- Hiện tại, tất cả dữ liệu được lưu trữ trên máy chủ tại Việt Nam
- Một số dịch vụ bên thứ ba (Google Analytics, Facebook) có thể chuyển dữ liệu ra nước ngoài
- Chúng tôi đảm bảo các bên thứ ba này tuân thủ các tiêu chuẩn bảo mật quốc tế

12. BẢO MẬT MẬT KHẨU

- Mật khẩu của bạn được mã hóa bằng thuật toán bcrypt (không thể giải mã)
- Chúng tôi không bao giờ lưu trữ mật khẩu dạng văn bản thuần (plaintext)
- Nhân viên GearUp không có khả năng xem mật khẩu của bạn
- Nếu quên mật khẩu, bạn chỉ có thể đặt lại mật khẩu mới (không thể lấy lại mật khẩu cũ)

Khuyến nghị:
- Sử dụng mật khẩu mạnh (ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường, số, ký tự đặc biệt)
- Không sử dụng lại mật khẩu đã dùng trên các website khác
- Thay đổi mật khẩu định kỳ (3-6 tháng)
- Không chia sẻ mật khẩu với bất kỳ ai

13. LIÊN HỆ VỀ CHÍNH SÁCH BẢO MẬT

Nếu có câu hỏi về Chính sách Bảo mật hoặc muốn thực hiện quyền của mình, vui lòng liên hệ:

Data Protection Officer (DPO):
📧 Email: privacy@gearup.vn
📞 Hotline: 1900 9999 (8:00 - 22:00 hàng ngày)
📍 Địa chỉ: Số 123, Đường Nguyễn Văn Linh, Quận 7, TP. Hồ Chí Minh

Chúng tôi cam kết phản hồi trong vòng 7 ngày làm việc kể từ khi nhận được yêu cầu.

Thông tin công ty:
- Tên công ty: Công ty TNHH GearUp Việt Nam
- Mã số thuế: 0123456789
- Giấy phép kinh doanh số: 0123456789 do Sở Kế hoạch và Đầu tư TP.HCM cấp ngày 01/01/2020

---
Cập nhật lần cuối: Tháng 11 năm 2025
Phiên bản: 1.0

Chúng tôi cam kết bảo vệ quyền riêng tư của bạn và sử dụng thông tin cá nhân một cách có trách nhiệm. Cảm ơn bạn đã tin tưởng GearUp!`;

async function fixEncoding() {
  try {
    console.log('🔧 Đang sửa encoding UTF-8 cho Terms & Privacy...');
    
    // Delete old data
    await pool.query('DELETE FROM terms_conditions');
    await pool.query('DELETE FROM privacy_policy');
    
    console.log('  ✅ Đã xóa dữ liệu cũ');
    
    // Insert với encoding đúng
    await pool.query(
      'INSERT INTO terms_conditions (title, content, version, active) VALUES (?, ?, ?, ?)',
      ['Điều khoản và Điều kiện', termsContent, '1.0', 1]
    );
    
    await pool.query(
      'INSERT INTO privacy_policy (title, content, version, active) VALUES (?, ?, ?, ?)',
      ['Chính sách Bảo mật', privacyContent, '1.0', 1]
    );
    
    console.log('  ✅ Đã insert dữ liệu mới với UTF-8');
    
    // Verify
    const [terms] = await pool.query('SELECT SUBSTRING(title, 1, 30) as title FROM terms_conditions');
    const [privacy] = await pool.query('SELECT SUBSTRING(title, 1, 30) as title FROM privacy_policy');
    
    console.log('\n📋 Kiểm tra kết quả:');
    console.log('  Terms title:', terms[0].title);
    console.log('  Privacy title:', privacy[0].title);
    
    console.log('\n✅ Hoàn tất! Vui lòng restart auth-service: docker-compose restart auth-service');
    
  } catch (error) {
    console.error('❌ Lỗi:', error);
  } finally {
    await pool.end();
  }
}

fixEncoding();
