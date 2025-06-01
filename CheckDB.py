import sqlite3

# データベースファイル名
db_name = 'VWAP_Alpha.db'

def view_all_tables_and_contents(database_filename):
    """
    指定されたSQLiteデータベース内のすべてのテーブル名とその内容を表示します。
    """
    conn = None  # 接続オブジェクトを初期化
    try:
        # データベースに接続
        conn = sqlite3.connect(database_filename)
        cursor = conn.cursor()

        # 1. すべてのテーブル名を取得
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()

        if not tables:
            print(f"データベース '{database_filename}' にテーブルが見つかりません。")
            return

        print(f"データベース '{database_filename}' の内容:")
        print("=" * 40)

        # 2. 各テーブルの内容を表示
        for table_info in tables:
            table_name = table_info[0]
            # sqlite_sequence はSQLiteが自動的に作成・管理するテーブルで、
            # 通常ユーザーが直接関心を持つデータは含まれていません。
            # 表示したくない場合はここでスキップできます。
            # if table_name == 'sqlite_sequence':
            #     continue

            print(f"\nテーブル名: {table_name}")
            print("-" * (len(table_name) + 14))

            try:
                # テーブルから全てのデータを取得
                cursor.execute(f"SELECT * FROM [{table_name}]") # テーブル名に特殊文字が含まれる可能性を考慮

                # カラム名を取得
                column_names = [description[0] for description in cursor.description]
                if column_names:
                    print(" | ".join(column_names))
                    print("-" * (sum(len(col) for col in column_names) + (len(column_names) -1) * 3 + 4 )) # 区切り線

                rows = cursor.fetchall()

                if not rows:
                    print("このテーブルにデータはありません。")
                else:
                    for row in rows:
                        print(" | ".join(map(str, row)))
            except sqlite3.Error as e:
                print(f"テーブル '{table_name}' の読み取り中にエラーが発生しました: {e}")
            print("-" * (len(table_name) + 14))

        print("=" * 40)

    except sqlite3.Error as e:
        print(f"データベースエラーが発生しました: {e}")
    except FileNotFoundError:
        print(f"データベースファイル '{database_filename}' が見つかりません。")
    finally:
        # 接続を閉じる
        if conn:
            conn.close()
            print("\nデータベース接続を閉じました。")

if __name__ == "__main__":
    view_all_tables_and_contents(db_name)
    