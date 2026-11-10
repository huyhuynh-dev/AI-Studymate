export function getOtpMailHtml(
    otpCode: string,
    expirateInSeconds: number,
    userName?: string,
): string {
    return `
			<!DOCTYPE html>
			<html lang="vi">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
			</head>

			<body style="
				margin: 0;
				padding: 0;
				background-color: #f4f7fb;
				font-family: Arial, Helvetica, sans-serif;
			">

				<table
					width="100%"
					cellpadding="0"
					cellspacing="0"
					style="padding: 40px 20px;"
				>
					<tr>
						<td align="center">

							<table
								width="100%"
								cellpadding="0"
								cellspacing="0"
								style="
									max-width: 560px;
									background-color: #ffffff;
									border-radius: 12px;
									overflow: hidden;
								"
							>

								<!-- Header -->
								<tr>
									<td
										align="center"
										style="
											padding: 28px;
											background-color: #2563eb;
											color: white;
										"
									>
										<div style="
											font-size: 24px;
											font-weight: bold;
										">
											AI StudyMate
										</div>

										<div style="
											margin-top: 6px;
											font-size: 14px;
										">
											Your Intelligent Learning Assistant
										</div>
									</td>
								</tr>

								<!-- Content -->
								<tr>
									<td style="padding: 36px 40px;">

										<h1 style="
											margin: 0 0 16px;
											font-size: 24px;
											color: #111827;
										">
											Mã xác thực OTP
										</h1>

										<p style="
											font-size: 15px;
											line-height: 1.6;
											color: #4b5563;
										">
											Xin chào
											<strong>${userName ?? 'bạn'}</strong>,
										</p>

										<p style="
											font-size: 15px;
											line-height: 1.6;
											color: #4b5563;
										">
											Mã OTP của bạn là:
										</p>

										<!-- OTP -->
										<div style="
											margin: 24px 0;
											padding: 16px;
											text-align: center;
											background-color: #eff6ff;
											border: 1px solid #bfdbfe;
											border-radius: 8px;
										">
											<span style="
												font-size: 32px;
												font-weight: bold;
												letter-spacing: 8px;
												color: #2563eb;
											">
												${otpCode}
											</span>
										</div>

										<p style="
											text-align: center;
											font-size: 14px;
											color: #6b7280;
										">
											Mã OTP có hiệu lực trong
											<strong>${expirateInSeconds / 60} phút</strong>.
										</p>

										<!-- Warning -->
										<div style="
											margin-top: 24px;
											padding: 14px;
											background-color: #fef3c7;
											border-left: 4px solid #f59e0b;
										">
											<p style="
												margin: 0;
												font-size: 13px;
												line-height: 1.5;
												color: #92400e;
											">
												<strong>Lưu ý:</strong>
												Không chia sẻ mã OTP này với bất kỳ ai.
											</p>
										</div>

									</td>
								</tr>

								<!-- Footer -->
								<tr>
									<td
										align="center"
										style="
											padding: 20px;
											background-color: #f9fafb;
											color: #9ca3af;
											font-size: 12px;
										"
									>
										© ${new Date().getFullYear()} AI StudyMate
									</td>
								</tr>

							</table>

						</td>
					</tr>
				</table>

			</body>
			</html>
		`;
}
